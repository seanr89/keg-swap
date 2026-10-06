/**
 * Firestore access for the drinks and reviews that belong to an event.
 *
 * Layout:
 *   events/{eventId}                                   event metadata + drinkCount
 *   events/{eventId}/drinks/{drinkId}                  BeerDrinkDoc
 *   events/{eventId}/drinks/{drinkId}/reviews/{id}     BeerReviewDoc
 *
 * Events created before the subcollections existed still carry an embedded `drinks`
 * array; `migrateLegacyEvent` moves that data over and `assembleDrinks` merges both
 * shapes so the UI works at any point during the migration.
 */

import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { db } from '../firebase';
import { migrateEventImagesToStorage } from './imageUtils';
import type { BeerDrink, BeerDrinkDoc, BeerEvent, BeerReview, BeerReviewDoc } from '../types';

// Firestore allows 500 writes per batch; stay well below it.
const BATCH_LIMIT = 400;

export const drinksCollection = (eventId: string) => collection(db, 'events', eventId, 'drinks');
export const reviewsGroup = () => collectionGroup(db, 'reviews');

const eventRef = (eventId: string) => doc(db, 'events', eventId);
const drinkRef = (eventId: string, drinkId: string) => doc(db, 'events', eventId, 'drinks', drinkId);
const reviewRef = (eventId: string, drinkId: string, reviewId: string) =>
  doc(db, 'events', eventId, 'drinks', drinkId, 'reviews', reviewId);

/** Firestore rejects `undefined` field values, so drop them before writing. */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function toDrinkDoc(drink: BeerDrink): BeerDrinkDoc {
  const { reviews: _reviews, ...rest } = drink;
  return withoutUndefined(rest);
}

function toReviewDoc(
  eventId: string,
  drink: Pick<BeerDrink, 'id' | 'name' | 'brewery' | 'style'>,
  review: BeerReview
): BeerReviewDoc {
  return withoutUndefined({
    ...review,
    eventId,
    drinkId: drink.id,
    drinkName: drink.name,
    brewery: drink.brewery,
    style: drink.style,
  });
}

/** Legacy embedded drinks keep their array order by sorting ahead of every real timestamp. */
const legacyCreatedAt = (index: number) => new Date(index).toISOString();

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function deleteRefs(refs: DocumentReference[]): Promise<void> {
  for (const group of chunk(refs, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    group.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/** Adds drinks and bumps the event's `drinkCount` in the same atomic batch. */
export async function addDrinks(eventId: string, drinks: BeerDrink[]): Promise<void> {
  const base = Date.now();
  const stamped = drinks.map((drink, i) => ({ ...drink, createdAt: new Date(base + i).toISOString() }));

  for (const group of chunk(stamped, BATCH_LIMIT - 1)) {
    const batch = writeBatch(db);
    group.forEach((drink) => batch.set(drinkRef(eventId, drink.id), toDrinkDoc(drink)));
    batch.update(eventRef(eventId), { drinkCount: increment(group.length) });
    await batch.commit();
  }
}

export async function addReview(
  eventId: string,
  drink: Pick<BeerDrink, 'id' | 'name' | 'brewery' | 'style'>,
  review: BeerReview
): Promise<void> {
  await setDoc(reviewRef(eventId, drink.id, review.id), toReviewDoc(eventId, drink, review));
}

/** Firestore does not cascade deletes, so remove the drinks and reviews before the event itself. */
export async function deleteEventCascade(eventId: string): Promise<void> {
  const [reviews, drinks] = await Promise.all([
    getDocs(query(reviewsGroup(), where('eventId', '==', eventId))),
    getDocs(drinksCollection(eventId)),
  ]);
  await deleteRefs([...reviews.docs.map((d) => d.ref), ...drinks.docs.map((d) => d.ref)]);
  await deleteDoc(eventRef(eventId));
}

/**
 * Moves the drinks and reviews embedded in an event document into subcollections,
 * then removes the embedded array. Safe to run repeatedly or from several clients at
 * once: document ids are deterministic, so a second run rewrites identical data.
 */
export async function migrateLegacyEvent(event: BeerEvent): Promise<void> {
  if (!event.drinks || event.drinks.length === 0) return;

  // Base64 images would push each subcollection document towards the 1MB limit.
  const { event: withImages } = await migrateEventImagesToStorage(event);
  const legacyDrinks = withImages.drinks ?? [];

  const existing = await getDocs(drinksCollection(event.id));
  const existingIds = new Set(existing.docs.map((d) => d.id));

  const writes: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  legacyDrinks.forEach((drink, i) => {
    if (!existingIds.has(drink.id)) {
      const drinkDoc = toDrinkDoc({ ...drink, createdAt: drink.createdAt ?? legacyCreatedAt(i) });
      writes.push((batch) => batch.set(drinkRef(event.id, drink.id), drinkDoc));
    }
    (drink.reviews ?? []).forEach((review) => {
      const reviewDoc = toReviewDoc(event.id, drink, review);
      writes.push((batch) => batch.set(reviewRef(event.id, drink.id, review.id), reviewDoc));
    });
  });

  for (const group of chunk(writes, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    group.forEach((write) => write(batch));
    await batch.commit();
  }

  const totalDrinks = new Set([...existingIds, ...legacyDrinks.map((d) => d.id)]).size;
  await updateDoc(eventRef(event.id), { drinkCount: totalDrinks, drinks: deleteField() });
}

/**
 * Builds the `BeerDrink[]` the UI works with from subcollection documents, merged
 * with any drinks still embedded in a not-yet-migrated event (subcollection wins).
 */
export function assembleDrinks(
  legacyDrinks: BeerDrink[] | undefined,
  drinkDocs: BeerDrinkDoc[],
  reviewDocs: BeerReviewDoc[]
): BeerDrink[] {
  const byId = new Map<string, BeerDrink>();

  (legacyDrinks ?? []).forEach((drink, i) => {
    byId.set(drink.id, {
      ...drink,
      createdAt: drink.createdAt ?? legacyCreatedAt(i),
      reviews: [...(drink.reviews ?? [])],
    });
  });

  drinkDocs.forEach((drinkDoc) => {
    byId.set(drinkDoc.id, { ...drinkDoc, reviews: byId.get(drinkDoc.id)?.reviews ?? [] });
  });

  reviewDocs.forEach((reviewDoc) => {
    const drink = byId.get(reviewDoc.drinkId);
    if (!drink) return;
    const { eventId: _e, drinkId: _d, drinkName: _n, brewery: _b, style: _s, ...review } = reviewDoc;
    drink.reviews = [...drink.reviews.filter((r) => r.id !== review.id), review];
  });

  const drinks = Array.from(byId.values());
  drinks.forEach((drink) => {
    drink.reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  return drinks.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}
