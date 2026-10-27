import { useCallback, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
  computeMoveTopFive,
  computeSwapTopFive,
  computeToggleTopFive,
  normalizeTopFiveIds,
  setTopFiveDrinks,
  setWishlisted,
  wishlistRef,
  type TopFiveToggleAction,
} from '../utils/wishlist';

interface Slice {
  key: string;
  ids: Set<string>;
  topFiveIds: string[];
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_ARRAY: readonly string[] = [];
const sliceKey = (uid: string, eventId: string) => `${uid}/${eventId}`;

/**
 * Live set of the user's bookmarked drink ids and ordered Top 5 "Must-Try" drink ids for one event.
 * Subscribes only while the event is open. Data from a previously opened event is ignored until
 * the new snapshot arrives.
 * Firestore applies local writes to snapshots straight away, so operations need no extra optimistic state.
 */
export function useWishlist(uid: string, eventId: string, validDrinkIds?: ReadonlySet<string>) {
  const [slice, setSlice] = useState<Slice | null>(null);

  useEffect(() => {
    const key = sliceKey(uid, eventId);
    return onSnapshot(
      wishlistRef(uid, eventId),
      (snapshot) => {
        const data = snapshot.data() as { drinkIds?: string[]; topFiveDrinkIds?: string[] } | undefined;
        setSlice({
          key,
          ids: new Set(data?.drinkIds ?? []),
          topFiveIds: normalizeTopFiveIds(data?.topFiveDrinkIds),
        });
      },
      (err) => console.error('Firestore wishlist snapshot error:', err)
    );
  }, [uid, eventId]);

  const isCurrentSlice = slice?.key === sliceKey(uid, eventId);
  const wishlist: ReadonlySet<string> = isCurrentSlice ? slice.ids : EMPTY_SET;

  const topFiveDrinkIds: readonly string[] = useMemo(() => {
    if (!isCurrentSlice) return EMPTY_ARRAY;
    return normalizeTopFiveIds(slice.topFiveIds, validDrinkIds);
  }, [isCurrentSlice, slice, validDrinkIds]);

  const topFiveSet: ReadonlySet<string> = useMemo(() => new Set(topFiveDrinkIds), [topFiveDrinkIds]);

  const isTopFive = useCallback(
    (drinkId: string): boolean => topFiveSet.has(drinkId),
    [topFiveSet]
  );

  const getTopFiveRank = useCallback(
    (drinkId: string): number | null => {
      const idx = topFiveDrinkIds.indexOf(drinkId);
      return idx === -1 ? null : idx + 1;
    },
    [topFiveDrinkIds]
  );

  const toggle = useCallback(
    (drinkId: string) => {
      setWishlisted(uid, eventId, drinkId, !wishlist.has(drinkId)).catch((err: unknown) =>
        console.error('Failed to update wishlist:', err)
      );
    },
    [uid, eventId, wishlist]
  );

  const toggleTopFive = useCallback(
    async (drinkId: string): Promise<TopFiveToggleAction> => {
      const { nextIds, action } = computeToggleTopFive(topFiveDrinkIds, drinkId);
      if (action === 'limit-reached') {
        return 'limit-reached';
      }
      try {
        await setTopFiveDrinks(
          uid,
          eventId,
          nextIds,
          action === 'added' ? drinkId : undefined
        );
      } catch (err: unknown) {
        console.error('Failed to update Top 5 wishlist:', err);
      }
      return action;
    },
    [uid, eventId, topFiveDrinkIds]
  );

  const swapTopFive = useCallback(
    async (removeDrinkId: string, addDrinkId: string): Promise<void> => {
      const nextIds = computeSwapTopFive(topFiveDrinkIds, removeDrinkId, addDrinkId);
      try {
        await setTopFiveDrinks(uid, eventId, nextIds, addDrinkId);
      } catch (err: unknown) {
        console.error('Failed to swap Top 5 wishlist drink:', err);
      }
    },
    [uid, eventId, topFiveDrinkIds]
  );

  const moveTopFive = useCallback(
    async (fromIndex: number, toIndex: number): Promise<void> => {
      const nextIds = computeMoveTopFive(topFiveDrinkIds, fromIndex, toIndex);
      try {
        await setTopFiveDrinks(uid, eventId, nextIds);
      } catch (err: unknown) {
        console.error('Failed to reorder Top 5 wishlist:', err);
      }
    },
    [uid, eventId, topFiveDrinkIds]
  );

  const reorderTopFive = useCallback(
    async (newOrder: readonly string[]): Promise<void> => {
      const nextIds = normalizeTopFiveIds(newOrder, validDrinkIds);
      try {
        await setTopFiveDrinks(uid, eventId, nextIds);
      } catch (err: unknown) {
        console.error('Failed to reorder Top 5 wishlist:', err);
      }
    },
    [uid, eventId, validDrinkIds]
  );

  return {
    wishlist,
    toggle,
    topFiveDrinkIds,
    topFiveSet,
    isTopFive,
    getTopFiveRank,
    toggleTopFive,
    swapTopFive,
    moveTopFive,
    reorderTopFive,
  };
}
