import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const MAX_TOP_FIVE = 5;

export type TopFiveToggleAction = 'added' | 'removed' | 'limit-reached';

/** `users/{uid}/wishlists/{eventId}` holds `{ drinkIds: string[], topFiveDrinkIds?: string[], updatedAt: string }`. */
export const wishlistRef = (uid: string, eventId: string) => doc(db, 'users', uid, 'wishlists', eventId);

/**
 * Deduplicates non-empty drink IDs in order, optionally pruning IDs not present in `validDrinkIds`,
 * and enforces the `MAX_TOP_FIVE` capacity cap.
 */
export function normalizeTopFiveIds(
  ids: readonly string[] | undefined,
  validDrinkIds?: ReadonlySet<string>
): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    if (validDrinkIds && !validDrinkIds.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_TOP_FIVE) break;
  }
  return result;
}

/**
 * Pure state transition for toggling a drink in the user's Top 5 list.
 * Returns `'limit-reached'` without mutating the list when already at 5 items.
 */
export function computeToggleTopFive(
  currentIds: readonly string[],
  drinkId: string
): { nextIds: string[]; action: TopFiveToggleAction } {
  const normalized = normalizeTopFiveIds(currentIds);
  const trimmedId = drinkId.trim();
  if (!trimmedId) {
    return { nextIds: normalized, action: 'limit-reached' };
  }

  if (normalized.includes(trimmedId)) {
    return {
      nextIds: normalized.filter((id) => id !== trimmedId),
      action: 'removed',
    };
  }

  if (normalized.length >= MAX_TOP_FIVE) {
    return {
      nextIds: normalized,
      action: 'limit-reached',
    };
  }

  return {
    nextIds: [...normalized, trimmedId],
    action: 'added',
  };
}

/**
 * Pure state transition for swapping an existing Top 5 pick (`removeDrinkId`) with a new drink (`addDrinkId`)
 * at the same rank slot.
 */
export function computeSwapTopFive(
  currentIds: readonly string[],
  removeDrinkId: string,
  addDrinkId: string
): string[] {
  const normalized = normalizeTopFiveIds(currentIds);
  const targetAdd = addDrinkId.trim();
  const targetRemove = removeDrinkId.trim();
  if (!targetAdd) return normalized;

  const withoutAdd = normalized.filter((id) => id !== targetAdd);
  const replaceIdx = withoutAdd.indexOf(targetRemove);

  if (replaceIdx !== -1) {
    const next = [...withoutAdd];
    next[replaceIdx] = targetAdd;
    return normalizeTopFiveIds(next);
  }

  if (withoutAdd.length >= MAX_TOP_FIVE) {
    return normalizeTopFiveIds([...withoutAdd.slice(0, MAX_TOP_FIVE - 1), targetAdd]);
  }

  return normalizeTopFiveIds([...withoutAdd, targetAdd]);
}

/**
 * Pure state transition for moving a Top 5 drink from one rank index to another (`0` to `length - 1`).
 */
export function computeMoveTopFive(
  currentIds: readonly string[],
  fromIndex: number,
  toIndex: number
): string[] {
  const normalized = normalizeTopFiveIds(currentIds);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= normalized.length ||
    toIndex >= normalized.length ||
    fromIndex === toIndex
  ) {
    return normalized;
  }

  const next = [...normalized];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Adds or removes one drink from the general wishlist. `merge` lets the first bookmark create the doc,
 * and the array operators are atomic, idempotent, and queue while offline.
 */
export function setWishlisted(uid: string, eventId: string, drinkId: string, on: boolean): Promise<void> {
  return setDoc(
    wishlistRef(uid, eventId),
    {
      drinkIds: on ? arrayUnion(drinkId) : arrayRemove(drinkId),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Persists the ordered `topFiveDrinkIds` array (capped at 5) for an event.
 * When `ensureWishlistedDrinkId` is provided, also ensures that drink is included in `drinkIds`.
 */
export function setTopFiveDrinks(
  uid: string,
  eventId: string,
  topFiveDrinkIds: readonly string[],
  ensureWishlistedDrinkId?: string
): Promise<void> {
  const sanitized = normalizeTopFiveIds(topFiveDrinkIds);
  return setDoc(
    wishlistRef(uid, eventId),
    {
      topFiveDrinkIds: sanitized,
      ...(ensureWishlistedDrinkId ? { drinkIds: arrayUnion(ensureWishlistedDrinkId) } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
