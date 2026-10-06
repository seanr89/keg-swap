import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { reviewsGroup } from '../utils/eventData';
import type { BeerReviewDoc } from '../types';

interface Slice {
  uid: string;
  items: BeerReviewDoc[];
}

/** Live list of every review written by `uid`, across all events. */
export function useUserReviews(uid: string) {
  const [slice, setSlice] = useState<Slice | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(reviewsGroup(), where('userId', '==', uid)),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as BeerReviewDoc);
        setSlice({ uid, items });
      },
      (err) => console.error('Firestore user reviews snapshot error:', err)
    );
  }, [uid]);

  const loaded = slice?.uid === uid;
  return { reviews: loaded ? slice.items : [], loading: !loaded };
}
