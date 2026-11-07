import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useEvents } from './useEvents';
import type { BeerEvent } from '../types';

const mockAddDoc = vi.fn(async () => ({ id: 'new-event-id' }));
const mockUpdateDoc = vi.fn(async () => Promise.resolve());
const mockAddDrinks = vi.fn(async () => Promise.resolve());
const mockAddReview = vi.fn(async () => Promise.resolve());
const mockDeleteReview = vi.fn(async () => Promise.resolve());
const mockDeleteEventCascade = vi.fn(async () => Promise.resolve());
const mockMigrateLegacyEvent = vi.fn(async () => Promise.resolve());
const mockUpdateDrinkAvailability = vi.fn(async () => Promise.resolve());

type EventsSnapshotCallback = (snap: {
  empty: boolean;
  forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
}) => void;

let eventsSnapshotCallback: EventsSnapshotCallback | null = null;

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, col: string) => ({ path: col }),
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  orderBy: (field: string, dir: string) => ({ field, dir }),
  query: (col: { path: string }) => ({ path: col.path }),
  addDoc: (...args: unknown[]) => mockAddDoc(...(args as [])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
  onSnapshot: (_q: unknown, onNext: EventsSnapshotCallback) => {
    eventsSnapshotCallback = onNext;
    return () => {
      eventsSnapshotCallback = null;
    };
  },
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('../utils/eventData', () => ({
  addDrinks: (...args: unknown[]) => mockAddDrinks(...(args as [])),
  addReview: (...args: unknown[]) => mockAddReview(...(args as [])),
  deleteReview: (...args: unknown[]) => mockDeleteReview(...(args as [])),
  deleteEventCascade: (...args: unknown[]) => mockDeleteEventCascade(...(args as [])),
  migrateLegacyEvent: (...args: unknown[]) => mockMigrateLegacyEvent(...(args as [])),
  updateDrinkAvailability: (...args: unknown[]) => mockUpdateDrinkAvailability(...(args as [])),
}));

vi.mock('../utils/imageUtils', () => ({
  isBase64DataUrl: () => false,
  sanitizeOrUploadImageUrl: vi.fn(async (url: string) => url),
}));

vi.mock('../utils/testEventSeeder', () => ({
  generateDrinkId: () => 'gen-drink-id',
  seedTestEventWithDrinks: vi.fn(async () => Promise.resolve()),
}));

describe('useEvents hook', () => {
  const mockUser = { uid: 'user-1', email: 'u1@example.com' } as User;

  beforeEach(() => {
    vi.clearAllMocks();
    eventsSnapshotCallback = null;
  });

  it('subscribes to events, checks deletion authorization, and performs event/drink/status updates', async () => {
    const { result } = renderHook(() => useEvents(mockUser, false));

    act(() => {
      eventsSnapshotCallback?.({
        empty: false,
        forEach: (cb) => {
          cb({
            id: 'ev-1',
            data: () => ({
              name: 'Leeds Craft Fest',
              date: '2026-11-01',
              address: 'Leeds',
              status: 'Upcoming',
              userId: 'user-1',
              attendees: [],
            }),
          });
          cb({
            id: 'ev-2',
            data: () => ({
              name: 'Other User Fest',
              date: '2026-11-05',
              address: 'York',
              status: 'Upcoming',
              userId: 'user-2',
              attendees: ['user-1'],
            }),
          });
        },
      });
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.canDeleteEvent(result.current.events[0])).toBe(true);
    expect(result.current.canDeleteEvent(result.current.events[1])).toBe(false);

    // Create event with initial drinks
    await act(async () => {
      const ok = await result.current.addEvent(
        {
          name: 'Winter Ale Trail',
          date: '2026-12-01',
          address: 'Manchester',
          status: 'Upcoming',
        },
        [
          {
            name: 'Frostbite IPA',
            brewery: 'Northern Monk',
            location: 'Leeds',
            abv: '6.0%',
            style: 'IPA',
            description: 'Crisp pine',
          },
        ]
      );
      expect(ok).toBe(true);
    });
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDrinks).toHaveBeenCalledWith('new-event-id', [
      expect.objectContaining({ id: 'gen-drink-id', name: 'Frostbite IPA' }),
    ]);

    // Update status
    await act(async () => {
      await result.current.updateStatus('ev-1', 'Ongoing');
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith({ path: 'events/ev-1' }, { status: 'Ongoing' });

    // Toggle attendance
    await act(async () => {
      await result.current.toggleAttendance('ev-1');
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'events/ev-1' },
      { attendees: ['user-1'] }
    );

    // Delete authorized vs unauthorized
    await act(async () => {
      const denied = await result.current.deleteEvent(result.current.events[1] as BeerEvent);
      expect(denied).toBe(false);
      const allowed = await result.current.deleteEvent(result.current.events[0] as BeerEvent);
      expect(allowed).toBe(true);
    });
    expect(mockDeleteEventCascade).toHaveBeenCalledTimes(1);
    expect(mockDeleteEventCascade).toHaveBeenCalledWith('ev-1');

    // Delete drink review
    await act(async () => {
      const ok = await result.current.deleteDrinkReview(
        'ev-1',
        'drink-1',
        'rev-1',
        'https://firebasestorage.googleapis.com/v0/b/app/o/img.jpg'
      );
      expect(ok).toBe(true);
    });
    expect(mockDeleteReview).toHaveBeenCalledWith(
      'ev-1',
      'drink-1',
      'rev-1',
      'https://firebasestorage.googleapis.com/v0/b/app/o/img.jpg'
    );

    // Update drink availability
    await act(async () => {
      await result.current.updateDrinkAvailability('ev-1', 'drink-1', false);
    });
    expect(mockUpdateDrinkAvailability).toHaveBeenCalledWith('ev-1', 'drink-1', false);

    // Guard: cannot add review to unavailable drink
    await act(async () => {
      await result.current.addDrinkReview(
        'ev-1',
        {
          id: 'drink-1',
          name: 'Northern Star',
          brewery: 'North Brew',
          location: 'Leeds',
          abv: '5.2%',
          style: 'Porter',
          description: 'Rich roasted malt',
          reviews: [],
          isAvailable: false,
        },
        'Ale Explorer',
        9.0,
        'Delicious'
      );
    });
    expect(mockAddReview).not.toHaveBeenCalled();
  });
});
