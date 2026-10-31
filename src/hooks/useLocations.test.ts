import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useLocations } from './useLocations';

const mockAddDoc = vi.fn(async () => ({ id: 'loc-new' }));
const mockUpdateDoc = vi.fn(async () => Promise.resolve());
const mockDeleteDoc = vi.fn(async () => Promise.resolve());

type LocationsSnapshotCallback = (snap: {
  forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
}) => void;

let locationsSnapshotCallback: LocationsSnapshotCallback | null = null;

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, col: string) => ({ path: col }),
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  orderBy: (field: string, dir: string) => ({ field, dir }),
  query: (col: { path: string }) => ({ path: col.path }),
  addDoc: (...args: unknown[]) => mockAddDoc(...(args as [])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...(args as [])),
  onSnapshot: (_q: unknown, onNext: LocationsSnapshotCallback) => {
    locationsSnapshotCallback = onNext;
    return () => {
      locationsSnapshotCallback = null;
    };
  },
}));

vi.mock('../firebase', () => ({
  db: {},
}));

describe('useLocations hook', () => {
  const mockUser = { uid: 'admin-1', email: 'admin@example.com' } as User;

  beforeEach(() => {
    vi.clearAllMocks();
    locationsSnapshotCallback = null;
  });

  it('subscribes to locations and performs create, update, and delete operations', async () => {
    const { result } = renderHook(() => useLocations(mockUser));

    act(() => {
      locationsSnapshotCallback?.({
        forEach: (cb) => {
          cb({
            id: 'loc-1',
            data: () => ({
              name: 'Corn Exchange',
              address: 'Call Ln, Leeds',
              createdAt: '2026-10-01T00:00:00Z',
            }),
          });
        },
      });
    });

    expect(result.current.locations).toHaveLength(1);
    expect(result.current.locations[0].name).toBe('Corn Exchange');

    // Create new location
    await act(async () => {
      await result.current.saveLocation({
        name: 'Northern Market',
        address: 'Great George St, Leeds',
      });
    });
    expect(mockAddDoc).toHaveBeenCalledTimes(1);

    // Update existing location
    await act(async () => {
      await result.current.saveLocation(
        {
          name: 'Corn Exchange Leeds',
          address: 'Call Ln, Leeds',
        },
        'loc-1'
      );
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'locations/loc-1' },
      { name: 'Corn Exchange Leeds', address: 'Call Ln, Leeds' }
    );

    // Delete location
    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });
    expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'locations/loc-1' });
  });
});
