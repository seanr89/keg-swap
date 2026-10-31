import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { EventLocation } from '../types';

export function useLocations(user: User | null) {
  const [locations, setLocations] = useState<EventLocation[]>([]);

  useEffect(() => {
    if (!user) {
      setLocations([]);
      return;
    }

    const q = query(collection(db, 'locations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: EventLocation[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as EventLocation);
        });
        setLocations(fetched);
      },
      (err) => {
        console.error('Firestore locations snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const saveLocation = useCallback(
    async (locationData: Omit<EventLocation, 'id' | 'createdAt'>, id?: string): Promise<void> => {
      if (!user) return;
      try {
        if (id) {
          await updateDoc(doc(db, 'locations', id), { ...locationData });
        } else {
          await addDoc(collection(db, 'locations'), {
            ...locationData,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to save location:', err);
      }
    },
    [user]
  );

  const deleteLocation = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'locations', id));
    } catch (err) {
      console.error('Failed to delete location:', err);
    }
  }, []);

  return {
    locations,
    saveLocation,
    deleteLocation,
  };
}
