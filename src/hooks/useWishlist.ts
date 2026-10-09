import { useCallback, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { setWishlisted, wishlistRef } from '../utils/wishlist';

interface Slice {
  key: string;
  ids: Set<string>;
}

const EMPTY: ReadonlySet<string> = new Set<string>();
const sliceKey = (uid: string, eventId: string) => `${uid}/${eventId}`;

/**
 * Live set of the user's bookmarked drink ids for one event. Subscribes only while the event
 * is open. Data from a previously opened event is ignored until the new snapshot arrives.
 * Firestore applies local writes to snapshots straight away, so `toggle` needs no optimistic state.
 */
export function useWishlist(uid: string, eventId: string) {
  const [slice, setSlice] = useState<Slice | null>(null);

  useEffect(() => {
    const key = sliceKey(uid, eventId);
    return onSnapshot(
      wishlistRef(uid, eventId),
      (snapshot) => {
        const data = snapshot.data() as { drinkIds?: string[] } | undefined;
        setSlice({ key, ids: new Set(data?.drinkIds ?? []) });
      },
      (err) => console.error('Firestore wishlist snapshot error:', err)
    );
  }, [uid, eventId]);

  const wishlist: ReadonlySet<string> = slice?.key === sliceKey(uid, eventId) ? slice.ids : EMPTY;

  const toggle = useCallback(
    (drinkId: string) => {
      setWishlisted(uid, eventId, drinkId, !wishlist.has(drinkId)).catch((err: unknown) =>
        console.error('Failed to update wishlist:', err)
      );
    },
    [uid, eventId, wishlist]
  );

  return { wishlist, toggle };
}
