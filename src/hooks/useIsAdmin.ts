import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * True when `admins/{uid}` exists for the signed-in user.
 * Server-side Firestore rules enforce the same check; this only drives the UI.
 */
export function useIsAdmin(user: User | null): boolean {
  const [adminUid, setAdminUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubscribe = onSnapshot(
      doc(db, 'admins', uid),
      (snap) => setAdminUid(snap.exists() ? uid : null),
      (err) => {
        console.error('Failed to read admin role:', err);
        setAdminUid(null);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Tying the flag to the uid prevents a stale `true` after switching accounts or signing out
  return !!user && adminUid === user.uid;
}
