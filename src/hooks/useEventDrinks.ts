import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { assembleDrinks, drinksCollection, reviewsGroup } from '../utils/eventData';
import type { BeerDrink, BeerDrinkDoc, BeerReviewDoc } from '../types';

interface Slice<T> {
  eventId: string;
  items: T[];
}

/**
 * Live drinks (with their reviews) for one event. Nothing is subscribed until an
 * event is open, which is the point of keeping drinks out of the events list.
 * `legacyDrinks` are drinks still embedded in an event that has not been migrated yet.
 */
export function useEventDrinks(eventId: string | null, legacyDrinks?: BeerDrink[]) {
  const [drinkSlice, setDrinkSlice] = useState<Slice<BeerDrinkDoc> | null>(null);
  const [reviewSlice, setReviewSlice] = useState<Slice<BeerReviewDoc> | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const unsubDrinks = onSnapshot(
      drinksCollection(eventId),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as BeerDrinkDoc);
        setDrinkSlice({ eventId, items });
      },
      (err) => console.error('Firestore drinks snapshot error:', err)
    );

    const unsubReviews = onSnapshot(
      query(reviewsGroup(), where('eventId', '==', eventId)),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as BeerReviewDoc);
        setReviewSlice({ eventId, items });
      },
      (err) => console.error('Firestore reviews snapshot error:', err)
    );

    return () => {
      unsubDrinks();
      unsubReviews();
    };
  }, [eventId]);

  // Data from a previously opened event is ignored until the new event's snapshots arrive.
  const loaded = !!eventId && drinkSlice?.eventId === eventId && reviewSlice?.eventId === eventId;

  const drinks = useMemo(
    () =>
      assembleDrinks(
        legacyDrinks,
        loaded && drinkSlice ? drinkSlice.items : [],
        loaded && reviewSlice ? reviewSlice.items : []
      ),
    [legacyDrinks, loaded, drinkSlice, reviewSlice]
  );

  return { drinks, loading: !!eventId && !loaded };
}
