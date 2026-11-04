import { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useIsAdmin } from './useIsAdmin';
import {
  deriveFriendCodeFromUid,
  parseScannedFriendPayload,
} from '../utils/friendCode';
import type { FriendCodeDoc, UserProfile } from '../types';

export interface AddFriendByCodeResult {
  status: 'added' | 'already_friends' | 'self' | 'not_found' | 'invalid_code';
  profile?: UserProfile;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [publicUsers, setPublicUsers] = useState<UserProfile[]>([]);
  const [privateFriendProfiles, setPrivateFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [authLoading, setAuthLoading] = useState(true);

  const isAdmin = useIsAdmin(user);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore User Profile Sync & Public Users Sync
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setPublicUsers([]);
      setPrivateFriendProfiles({});
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const defaultFriendCode = deriveFriendCodeFromUid(user.uid);

    // Sync logged-in user profile doc
    const unsubUser = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const raw = docSnap.data() as UserProfile;
        setUserProfile({
          ...raw,
          uid: raw.uid || user.uid,
          friendCode: raw.friendCode || defaultFriendCode,
        });
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || user.email || 'Ale Connoisseur',
          email: user.email || '',
          isPublic: true,
          friends: [],
          friendCode: defaultFriendCode,
          createdAt: new Date().toISOString(),
        };
        try {
          await setDoc(userDocRef, newProfile);
        } catch (err) {
          console.error('Failed to create user profile in Firestore:', err);
        }
      }
    });

    // Subscribe to public users (for friend search & friend name resolution)
    const usersQuery = query(collection(db, 'users'), where('isPublic', '==', true));
    const unsubAllUsers = onSnapshot(usersQuery, (snapshot) => {
      const fetched: UserProfile[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as UserProfile;
        fetched.push({
          ...data,
          uid: d.id,
          friendCode: data.friendCode || deriveFriendCodeFromUid(d.id),
        });
      });
      setPublicUsers(fetched);
    });

    return () => {
      unsubUser();
      unsubAllUsers();
    };
  }, [user]);

  // Combine publicUsers with any resolved private friends so UserProfileScreen can display their names
  const allUsers = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of publicUsers) {
      map.set(u.uid, u);
    }
    for (const [uid, profile] of Object.entries(privateFriendProfiles)) {
      if (!map.has(uid)) {
        map.set(uid, profile);
      }
    }
    return Array.from(map.values());
  }, [publicUsers, privateFriendProfiles]);

  /**
   * Publishes the current user's `friendCode` to `/friendCodes/{code}` (and backfills
   * `users/{uid}.friendCode` if needed) so other users can look it up even when `isPublic` is false.
   */
  const syncFriendCode = useCallback(async (): Promise<string | null> => {
    if (!user || !userProfile) return null;
    const code = userProfile.friendCode || deriveFriendCodeFromUid(user.uid);
    const directoryEntry: FriendCodeDoc = {
      uid: user.uid,
      displayName: userProfile.displayName || user.displayName || user.email || 'Ale Connoisseur',
      email: userProfile.email || user.email || '',
      friendCode: code,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'friendCodes', code), directoryEntry);
      await updateDoc(doc(db, 'users', user.uid), { friendCode: code });
    } catch (err) {
      console.error('Failed to sync friend code directory entry:', err);
    }
    return code;
  }, [user, userProfile]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const togglePrivacy = useCallback(async () => {
    if (!user || !userProfile) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        isPublic: !userProfile.isPublic,
      });
    } catch (err) {
      console.error('Failed to toggle privacy setting:', err);
    }
  }, [user, userProfile]);

  const addFriend = useCallback(
    async (friendUid: string, options?: { mutual?: boolean; friendProfile?: UserProfile }) => {
      if (!user || !userProfile || friendUid === user.uid) return;
      if (options?.friendProfile) {
        setPrivateFriendProfiles((prev) => ({
          ...prev,
          [friendUid]: options.friendProfile!,
        }));
      }

      const currentFriends = userProfile.friends || [];
      if (!currentFriends.includes(friendUid)) {
        const updatedFriends = [...currentFriends, friendUid];
        const userDocRef = doc(db, 'users', user.uid);
        try {
          await updateDoc(userDocRef, {
            friends: updatedFriends,
          });
        } catch (err) {
          console.error('Failed to add friend:', err);
        }
      }

      if (options?.mutual) {
        try {
          const targetDocRef = doc(db, 'users', friendUid);
          await updateDoc(targetDocRef, {
            friends: arrayUnion(user.uid),
          });
        } catch (err) {
          console.error('Failed to establish mutual friend link:', err);
        }
      }
    },
    [user, userProfile]
  );

  const removeFriend = useCallback(
    async (friendUid: string) => {
      if (!user || !userProfile) return;
      const currentFriends = userProfile.friends || [];
      const updatedFriends = currentFriends.filter((id) => id !== friendUid);
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userDocRef, {
          friends: updatedFriends,
        });
      } catch (err) {
        console.error('Failed to remove friend:', err);
      }
    },
    [user, userProfile]
  );

  /**
   * Resolves a Friend Code (or invite URL) to a `UserProfile`.
   * Checks `/friendCodes/{code}` first (supporting private profiles), then falls back
   * to in-memory public profiles and a Firestore query.
   */
  const lookupUserByFriendCode = useCallback(
    async (rawInput: string): Promise<UserProfile | null> => {
      const code = parseScannedFriendPayload(rawInput);
      if (!code) return null;

      // 1. Check current user
      if (user && userProfile) {
        const ownCode = userProfile.friendCode || deriveFriendCodeFromUid(user.uid);
        if (ownCode.toUpperCase() === code) {
          return { ...userProfile, friendCode: ownCode };
        }
      }

      // 2. Check `/friendCodes/{code}` directory document (works even for private accounts)
      if (typeof getDoc === 'function') {
        try {
          const codeSnap = await getDoc(doc(db, 'friendCodes', code));
          if (codeSnap && codeSnap.exists()) {
            const data = codeSnap.data() as FriendCodeDoc;
            const resolvedProfile: UserProfile = {
              uid: data.uid,
              displayName: data.displayName || 'Ale Connoisseur',
              email: data.email || '',
              isPublic: false,
              friendCode: data.friendCode || code,
            };
            setPrivateFriendProfiles((prev) => ({
              ...prev,
              [resolvedProfile.uid]: resolvedProfile,
            }));
            return resolvedProfile;
          }
        } catch {
          // Fall through to in-memory / query lookup
        }
      }

      // 3. Check in-memory users (publicUsers + cached private friends)
      const inMemoryMatch = allUsers.find((u) => {
        const uCode = (u.friendCode || deriveFriendCodeFromUid(u.uid)).toUpperCase();
        return uCode === code;
      });
      if (inMemoryMatch) {
        return inMemoryMatch;
      }

      // 4. Fallback query on public users with matching friendCode field
      if (typeof getDocs === 'function') {
        try {
          const q = query(
            collection(db, 'users'),
            where('isPublic', '==', true),
            where('friendCode', '==', code)
          );
          const snap = await getDocs(q);
          let found: UserProfile | null = null;
          snap.forEach((d) => {
            if (!found) {
              found = { ...(d.data() as UserProfile), uid: d.id };
            }
          });
          if (found) return found;
        } catch {
          // Ignore query errors
        }
      }

      return null;
    },
    [user, userProfile, allUsers]
  );

  /**
   * Looks up a user by Friend Code (or scanned QR payload) and connects both users as friends.
   */
  const addFriendByCode = useCallback(
    async (
      rawInput: string,
      options: { mutual?: boolean } = { mutual: true }
    ): Promise<AddFriendByCodeResult> => {
      const code = parseScannedFriendPayload(rawInput);
      if (!code) {
        return { status: 'invalid_code' };
      }

      const targetProfile = await lookupUserByFriendCode(code);
      if (!targetProfile) {
        return { status: 'not_found' };
      }

      if (user && targetProfile.uid === user.uid) {
        return { status: 'self', profile: targetProfile };
      }

      const currentFriends = userProfile?.friends || [];
      const alreadyFriends = currentFriends.includes(targetProfile.uid);

      await addFriend(targetProfile.uid, {
        mutual: options.mutual !== false,
        friendProfile: targetProfile,
      });

      return {
        status: alreadyFriends ? 'already_friends' : 'added',
        profile: targetProfile,
      };
    },
    [user, userProfile, lookupUserByFriendCode, addFriend]
  );

  return {
    user,
    userProfile,
    allUsers,
    authLoading,
    isAdmin,
    signOutUser,
    togglePrivacy,
    addFriend,
    removeFriend,
    syncFriendCode,
    lookupUserByFriendCode,
    addFriendByCode,
  };
}
