import { useCallback, useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { assembleDrinks, drinksCollection, reviewsGroup } from '../utils/eventData';
import type { BeerDrink, BeerDrinkDoc, BeerReviewDoc } from '../types';

export const DEFAULT_EVENT_DRINKS_WAIT_MS = 5000;
export const DEFAULT_EVENT_DRINKS_RETRY_DELAY_MS = 1000;
export const MAX_EVENT_DRINKS_RETRIES = 1;

interface Slice<T> {
  eventId: string;
  items: T[];
  seed: number;
}

interface AttemptState {
  eventId: string;
  attempt: number;
  retrying: boolean;
  error: string | null;
  reloadSeed: number;
}

export interface UseEventDrinksOptions {
  waitTimeoutMs?: number;
  retryDelayMs?: number;
}

/**
 * Live drinks (with their reviews) for one event. Nothing is subscribed until an
 * event is open, which is the point of keeping drinks out of the events list.
 * Includes an effective wait timeout and a single automatic retry if snapshots
 * stall or fail on initial selection.
 * `legacyDrinks` are drinks still embedded in an event that has not been migrated yet.
 */
export function useEventDrinks(
  eventId: string | null,
  legacyDrinks?: BeerDrink[],
  options?: UseEventDrinksOptions
) {
  const waitTimeoutMs = options?.waitTimeoutMs ?? DEFAULT_EVENT_DRINKS_WAIT_MS;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_EVENT_DRINKS_RETRY_DELAY_MS;

  const [drinkSlice, setDrinkSlice] = useState<Slice<BeerDrinkDoc> | null>(null);
  const [reviewSlice, setReviewSlice] = useState<Slice<BeerReviewDoc> | null>(null);
  const [attemptState, setAttemptState] = useState<AttemptState>({
    eventId: '',
    attempt: 0,
    retrying: false,
    error: null,
    reloadSeed: 0,
  });

  const currentAttempt = attemptState.eventId === eventId ? attemptState.attempt : 0;
  const currentSeed = attemptState.eventId === eventId ? attemptState.reloadSeed : 0;

  useEffect(() => {
    if (!eventId) return;

    let drinksReady = false;
    let reviewsReady = false;
    let settled = false;
    let retryDelayTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubDrinks: (() => void) | null = null;
    let unsubReviews: (() => void) | null = null;

    const cleanupSubscriptions = () => {
      if (unsubDrinks) {
        unsubDrinks();
        unsubDrinks = null;
      }
      if (unsubReviews) {
        unsubReviews();
        unsubReviews = null;
      }
    };

    const waitTimer = setTimeout(() => {
      if (settled || (drinksReady && reviewsReady)) return;
      settled = true;
      cleanupSubscriptions();

      if (currentAttempt < MAX_EVENT_DRINKS_RETRIES) {
        setAttemptState({
          eventId,
          attempt: currentAttempt + 1,
          retrying: true,
          error: null,
          reloadSeed: currentSeed,
        });
      } else {
        setAttemptState({
          eventId,
          attempt: currentAttempt,
          retrying: false,
          error: 'Unable to load event drinks after retrying. Please check your connection and try again.',
          reloadSeed: currentSeed,
        });
      }
    }, waitTimeoutMs);

    const handleSnapshotFailure = (source: 'drinks' | 'reviews', err: unknown) => {
      console.error(`Firestore ${source} snapshot error:`, err);
      if (settled) return;
      settled = true;
      clearTimeout(waitTimer);
      cleanupSubscriptions();

      if (currentAttempt < MAX_EVENT_DRINKS_RETRIES) {
        setAttemptState({
          eventId,
          attempt: currentAttempt,
          retrying: true,
          error: null,
          reloadSeed: currentSeed,
        });
        retryDelayTimer = setTimeout(() => {
          setAttemptState({
            eventId,
            attempt: currentAttempt + 1,
            retrying: true,
            error: null,
            reloadSeed: currentSeed,
          });
        }, retryDelayMs);
      } else {
        setAttemptState({
          eventId,
          attempt: currentAttempt,
          retrying: false,
          error: 'Unable to load event drinks after retrying. Please check your connection and try again.',
          reloadSeed: currentSeed,
        });
      }
    };

    const markLoadedIfComplete = () => {
      if (drinksReady && reviewsReady && !settled) {
        settled = true;
        clearTimeout(waitTimer);
        setAttemptState((prev) =>
          prev.eventId === eventId && (prev.retrying || prev.error)
            ? { ...prev, retrying: false, error: null }
            : prev
        );
      }
    };

    unsubDrinks = onSnapshot(
      drinksCollection(eventId),
      (snapshot) => {
        if (settled && !(drinksReady && reviewsReady)) return;
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as BeerDrinkDoc);
        drinksReady = true;
        setDrinkSlice({ eventId, items, seed: currentSeed });
        markLoadedIfComplete();
      },
      (err) => handleSnapshotFailure('drinks', err)
    );

    unsubReviews = onSnapshot(
      query(reviewsGroup(), where('eventId', '==', eventId)),
      (snapshot) => {
        if (settled && !(drinksReady && reviewsReady)) return;
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as BeerReviewDoc);
        reviewsReady = true;
        setReviewSlice({ eventId, items, seed: currentSeed });
        markLoadedIfComplete();
      },
      (err) => handleSnapshotFailure('reviews', err)
    );

    return () => {
      settled = true;
      clearTimeout(waitTimer);
      if (retryDelayTimer) {
        clearTimeout(retryDelayTimer);
      }
      cleanupSubscriptions();
    };
  }, [eventId, currentAttempt, currentSeed, waitTimeoutMs, retryDelayMs]);

  const retry = useCallback(() => {
    if (!eventId) return;
    setAttemptState((prev) => ({
      eventId,
      attempt: 0,
      retrying: false,
      error: null,
      reloadSeed: (prev.eventId === eventId ? prev.reloadSeed : 0) + 1,
    }));
  }, [eventId]);

  // Data from a previously opened event (or prior manual reload seed) is ignored until fresh snapshots arrive.
  const loaded =
    !!eventId &&
    drinkSlice?.eventId === eventId &&
    drinkSlice?.seed === currentSeed &&
    reviewSlice?.eventId === eventId &&
    reviewSlice?.seed === currentSeed;

  const activeError =
    eventId && attemptState.eventId === eventId && !loaded ? attemptState.error : null;

  const retrying =
    !!eventId && !loaded && !activeError && attemptState.eventId === eventId && attemptState.retrying;

  const loading = !!eventId && !loaded && !activeError;

  const drinks = useMemo(
    () =>
      assembleDrinks(
        legacyDrinks,
        loaded && drinkSlice ? drinkSlice.items : [],
        loaded && reviewSlice ? reviewSlice.items : []
      ),
    [legacyDrinks, loaded, drinkSlice, reviewSlice]
  );

  return { drinks, loading, retrying, error: activeError, retry };
}
