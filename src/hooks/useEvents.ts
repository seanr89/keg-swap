import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { BeerDrink, BeerEvent, BeerReview } from '../types';
import {
  addDrinks,
  addReview as persistReview,
  deleteEventCascade,
  migrateLegacyEvent,
} from '../utils/eventData';
import { isBase64DataUrl, sanitizeOrUploadImageUrl } from '../utils/imageUtils';
import { cleanTags } from '../utils/tastingTags';
import { generateDrinkId, seedTestEventWithDrinks } from '../utils/testEventSeeder';

const formatAbv = (abv: string) => {
  const trimmed = abv.trim();
  return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
};

export function useEvents(user: User | null, isAdmin = false) {
  const [events, setEvents] = useState<BeerEvent[]>([]);
  // Events whose legacy embedded drinks are being (or have been) migrated this session
  const migratingEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setEvents([]);
          return;
        }

        const fetchedEvents: BeerEvent[] = [];
        snapshot.forEach((docSnapshot) => {
          fetchedEvents.push({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          } as BeerEvent);
        });
        setEvents(fetchedEvents);

        // Move drinks still embedded in an event document into subcollections (once per session)
        fetchedEvents.forEach((ev) => {
          if (!ev.drinks?.length || migratingEventIds.current.has(ev.id)) return;
          migratingEventIds.current.add(ev.id);
          migrateLegacyEvent(ev).catch((migErr) => {
            migratingEventIds.current.delete(ev.id);
            console.error('Failed to migrate drinks to subcollections for event', ev.id, migErr);
          });
        });
      },
      (err) => {
        console.error('Firestore events snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const canDeleteEvent = useCallback(
    (event: BeerEvent): boolean =>
      isAdmin || (!!user && !!event.userId && event.userId === user.uid),
    [isAdmin, user]
  );

  const addEvent = useCallback(
    async (
      eventData: Omit<BeerEvent, 'id'>,
      initialDrinks?: Omit<BeerDrink, 'id' | 'reviews'>[]
    ): Promise<boolean> => {
      if (!user) return false;
      try {
        const docRef = await addDoc(collection(db, 'events'), {
          name: eventData.name,
          date: eventData.date,
          ...(eventData.endDate ? { endDate: eventData.endDate } : {}),
          address: eventData.address,
          ...(eventData.mapsUrl ? { mapsUrl: eventData.mapsUrl } : {}),
          ...(eventData.url ? { url: eventData.url } : {}),
          status: eventData.status,
          drinkCount: 0,
          userId: user.uid,
          createdAt: new Date().toISOString(),
        });

        if (initialDrinks && initialDrinks.length > 0) {
          const drinksWithIds: BeerDrink[] = initialDrinks.map((d) => ({
            ...d,
            id: generateDrinkId(),
            reviews: [],
          }));
          await addDrinks(docRef.id, drinksWithIds);
        }

        return true;
      } catch (err) {
        console.error('Failed to add event to Firestore:', err);
        return false;
      }
    },
    [user]
  );

  const deleteEvent = useCallback(
    async (event: BeerEvent): Promise<boolean> => {
      if (!canDeleteEvent(event)) return false;
      try {
        await deleteEventCascade(event.id);
        return true;
      } catch (err) {
        console.error('Failed to delete event from Firestore:', err);
        return false;
      }
    },
    [canDeleteEvent]
  );

  const updateStatus = useCallback(
    async (id: string, newStatus: BeerEvent['status']): Promise<void> => {
      try {
        await updateDoc(doc(db, 'events', id), { status: newStatus });
      } catch (err) {
        console.error('Failed to update event status in Firestore:', err);
      }
    },
    []
  );

  const toggleAttendance = useCallback(
    async (eventId: string): Promise<void> => {
      if (!user) return;
      const eventToUpdate = events.find((e) => e.id === eventId);
      if (!eventToUpdate) return;

      const currentAttendees = eventToUpdate.attendees || [];
      const isAttending = currentAttendees.includes(user.uid);
      const updatedAttendees = isAttending
        ? currentAttendees.filter((uid) => uid !== user.uid)
        : [...currentAttendees, user.uid];

      try {
        await updateDoc(doc(db, 'events', eventId), { attendees: updatedAttendees });
      } catch (err) {
        console.error('Failed to update event attendance in Firestore:', err);
      }
    },
    [user, events]
  );

  const addDrink = useCallback(
    async (
      eventId: string,
      drinkData: Omit<BeerDrink, 'id' | 'reviews'> & { id?: string }
    ): Promise<void> => {
      const finalDrinkId =
        drinkData.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());

      let finalImageUrl = drinkData.imageUrl?.trim();
      if (finalImageUrl && isBase64DataUrl(finalImageUrl)) {
        try {
          finalImageUrl = await sanitizeOrUploadImageUrl(
            finalImageUrl,
            `events/${eventId}/drinks/${finalDrinkId}.jpg`
          );
        } catch (uploadErr) {
          console.error('Failed to upload drink image to Cloud Storage:', uploadErr);
        }
      }

      const newDrink: BeerDrink = {
        ...drinkData,
        id: finalDrinkId,
        abv: formatAbv(drinkData.abv),
        imageUrl: finalImageUrl || undefined,
        reviews: [],
      };

      try {
        await addDrinks(eventId, [newDrink]);
      } catch (err) {
        console.error('Failed to add drink in Firestore:', err);
      }
    },
    []
  );

  const addDrinksBatch = useCallback(
    async (
      eventId: string,
      drinksData: (Omit<BeerDrink, 'id' | 'reviews'> & { id?: string })[]
    ): Promise<void> => {
      const newDrinks: BeerDrink[] = await Promise.all(
        drinksData.map(async (drinkData) => {
          const drinkId =
            drinkData.id ||
            (crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2) + Date.now().toString(36));
          let finalImageUrl = drinkData.imageUrl?.trim();
          if (finalImageUrl && isBase64DataUrl(finalImageUrl)) {
            try {
              finalImageUrl = await sanitizeOrUploadImageUrl(
                finalImageUrl,
                `events/${eventId}/drinks/${drinkId}.jpg`
              );
            } catch (err) {
              console.error(`Failed to upload batch drink image for ${drinkId}:`, err);
            }
          }

          return {
            ...drinkData,
            abv: formatAbv(drinkData.abv),
            id: drinkId,
            imageUrl: finalImageUrl || undefined,
            reviews: [],
          };
        })
      );

      try {
        await addDrinks(eventId, newDrinks);
      } catch (err) {
        console.error('Failed to batch add drinks in Firestore:', err);
      }
    },
    []
  );

  const addDrinkReview = useCallback(
    async (
      eventId: string,
      drink: BeerDrink | undefined,
      reviewer: string,
      rating: number,
      comment: string,
      price?: string,
      servingSize?: string,
      imageUrl?: string,
      reviewId?: string,
      tags?: string[]
    ): Promise<void> => {
      if (!drink) return;

      const finalReviewId =
        reviewId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());

      let finalImageUrl = imageUrl?.trim();
      if (finalImageUrl && isBase64DataUrl(finalImageUrl)) {
        try {
          finalImageUrl = await sanitizeOrUploadImageUrl(
            finalImageUrl,
            `events/${eventId}/reviews/${finalReviewId}.jpg`
          );
        } catch (uploadErr) {
          console.error('Failed to upload review image to Cloud Storage:', uploadErr);
        }
      }

      const cleanedTags = cleanTags(tags);
      const newReview: BeerReview = {
        id: finalReviewId,
        reviewer,
        rating,
        comment,
        createdAt: new Date().toISOString(),
        userId: user?.uid,
        ...(price?.trim() ? { price: price.trim() } : {}),
        ...(servingSize?.trim() ? { servingSize: servingSize.trim() } : {}),
        ...(finalImageUrl ? { imageUrl: finalImageUrl } : {}),
        ...(cleanedTags ? { tags: cleanedTags } : {}),
      };

      try {
        await persistReview(eventId, drink, newReview);
      } catch (err) {
        console.error('Failed to add review in Firestore:', err);
      }
    },
    [user]
  );

  const seedTestEvent = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      await seedTestEventWithDrinks(user.uid);
    } catch (err) {
      console.error('Failed to seed test event:', err);
      throw err;
    }
  }, [user]);

  return {
    events,
    canDeleteEvent,
    addEvent,
    deleteEvent,
    updateStatus,
    toggleAttendance,
    addDrink,
    addDrinksBatch,
    addDrinkReview,
    seedTestEvent,
  };
}
