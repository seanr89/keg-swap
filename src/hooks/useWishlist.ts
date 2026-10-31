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
 * the new snapshot arrives, and mutations apply immediate optimistic state updates so the
 * wishlist UI and filter controls refresh straight away when items are added or removed.
 */
export function useWishlist(uid: string, eventId: string, validDrinkIds?: ReadonlySet<string>) {
  const [slice, setSlice] = useState<Slice | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

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
  }, [uid, eventId, refreshKey]);

  const currentKey = sliceKey(uid, eventId);
  const isCurrentSlice = slice?.key === currentKey;

  const wishlist: ReadonlySet<string> = useMemo(() => {
    const rawIds = isCurrentSlice ? slice.ids : EMPTY_SET;
    if (!validDrinkIds || rawIds.size === 0) return rawIds;
    const pruned = new Set<string>();
    for (const id of rawIds) {
      if (validDrinkIds.has(id)) {
        pruned.add(id);
      }
    }
    return pruned;
  }, [isCurrentSlice, slice, validDrinkIds]);

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
      const trimmedId = drinkId.trim();
      if (!trimmedId) return;
      const nextOn = !wishlist.has(trimmedId);

      setSlice((prev) => {
        const baseIds = prev?.key === currentKey ? prev.ids : EMPTY_SET;
        const baseTopFive = prev?.key === currentKey ? prev.topFiveIds : [];
        const nextIds = new Set(baseIds);
        if (nextOn) {
          nextIds.add(trimmedId);
        } else {
          nextIds.delete(trimmedId);
        }
        return {
          key: currentKey,
          ids: nextIds,
          topFiveIds: baseTopFive,
        };
      });

      setWishlisted(uid, eventId, trimmedId, nextOn).catch((err: unknown) =>
        console.error('Failed to update wishlist:', err)
      );
    },
    [uid, eventId, currentKey, wishlist]
  );

  const toggleTopFive = useCallback(
    async (drinkId: string): Promise<TopFiveToggleAction> => {
      const { nextIds, action } = computeToggleTopFive(topFiveDrinkIds, drinkId);
      if (action === 'limit-reached') {
        return 'limit-reached';
      }

      const trimmedId = drinkId.trim();
      setSlice((prev) => {
        const baseIds = prev?.key === currentKey ? prev.ids : EMPTY_SET;
        const nextWishlist = new Set(baseIds);
        if (action === 'added' && trimmedId) {
          nextWishlist.add(trimmedId);
        }
        return {
          key: currentKey,
          ids: nextWishlist,
          topFiveIds: nextIds,
        };
      });

      try {
        await setTopFiveDrinks(
          uid,
          eventId,
          nextIds,
          action === 'added' ? trimmedId : undefined
        );
      } catch (err: unknown) {
        console.error('Failed to update Top 5 wishlist:', err);
      }
      return action;
    },
    [uid, eventId, currentKey, topFiveDrinkIds]
  );

  const swapTopFive = useCallback(
    async (removeDrinkId: string, addDrinkId: string): Promise<void> => {
      const nextIds = computeSwapTopFive(topFiveDrinkIds, removeDrinkId, addDrinkId);
      const trimmedAdd = addDrinkId.trim();

      setSlice((prev) => {
        const baseIds = prev?.key === currentKey ? prev.ids : EMPTY_SET;
        const nextWishlist = new Set(baseIds);
        if (trimmedAdd) {
          nextWishlist.add(trimmedAdd);
        }
        return {
          key: currentKey,
          ids: nextWishlist,
          topFiveIds: nextIds,
        };
      });

      try {
        await setTopFiveDrinks(uid, eventId, nextIds, trimmedAdd);
      } catch (err: unknown) {
        console.error('Failed to swap Top 5 wishlist drink:', err);
      }
    },
    [uid, eventId, currentKey, topFiveDrinkIds]
  );

  const moveTopFive = useCallback(
    async (fromIndex: number, toIndex: number): Promise<void> => {
      const nextIds = computeMoveTopFive(topFiveDrinkIds, fromIndex, toIndex);

      setSlice((prev) => ({
        key: currentKey,
        ids: prev?.key === currentKey ? prev.ids : new Set<string>(),
        topFiveIds: nextIds,
      }));

      try {
        await setTopFiveDrinks(uid, eventId, nextIds);
      } catch (err: unknown) {
        console.error('Failed to reorder Top 5 wishlist:', err);
      }
    },
    [uid, eventId, currentKey, topFiveDrinkIds]
  );

  const reorderTopFive = useCallback(
    async (newOrder: readonly string[]): Promise<void> => {
      const nextIds = normalizeTopFiveIds(newOrder, validDrinkIds);

      setSlice((prev) => ({
        key: currentKey,
        ids: prev?.key === currentKey ? prev.ids : new Set<string>(),
        topFiveIds: nextIds,
      }));

      try {
        await setTopFiveDrinks(uid, eventId, nextIds);
      } catch (err: unknown) {
        console.error('Failed to reorder Top 5 wishlist:', err);
      }
    },
    [uid, eventId, currentKey, validDrinkIds]
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
    refresh,
  };
}
