import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** `users/{uid}/wishlists/{eventId}` holds `{ drinkIds: string[], updatedAt: string }`. */
export const wishlistRef = (uid: string, eventId: string) => doc(db, 'users', uid, 'wishlists', eventId);

/**
 * Adds or removes one drink. `merge` lets the first bookmark create the doc, and the array
 * operators are atomic, idempotent, and queue while offline.
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
