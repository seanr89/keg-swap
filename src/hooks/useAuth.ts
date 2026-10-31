import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useIsAdmin } from './useIsAdmin';
import type { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
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
      setAllUsers([]);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);

    // Sync logged-in user profile doc
    const unsubUser = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || user.email || 'Ale Connoisseur',
          email: user.email || '',
          isPublic: true,
          friends: [],
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
        fetched.push({ ...d.data(), uid: d.id } as UserProfile);
      });
      setAllUsers(fetched);
    });

    return () => {
      unsubUser();
      unsubAllUsers();
    };
  }, [user]);

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
    async (friendUid: string) => {
      if (!user || !userProfile) return;
      const currentFriends = userProfile.friends || [];
      if (currentFriends.includes(friendUid)) return;
      const updatedFriends = [...currentFriends, friendUid];
      const userDocRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userDocRef, {
          friends: updatedFriends,
        });
      } catch (err) {
        console.error('Failed to add friend:', err);
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
  };
}
