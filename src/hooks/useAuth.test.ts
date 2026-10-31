import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useAuth } from './useAuth';

let authCallback: ((user: User | null) => void) | null = null;
const mockSignOut = vi.fn(async () => Promise.resolve());
const mockSetDoc = vi.fn(async () => Promise.resolve());
const mockUpdateDoc = vi.fn(async () => Promise.resolve());

type DocSnapshotHandler = (snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void;
type QuerySnapshotHandler = (snap: {
  forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => void;
}) => void;

let userDocSnapshotHandler: DocSnapshotHandler | null = null;
let publicUsersSnapshotHandler: QuerySnapshotHandler | null = null;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: User | null) => void) => {
    authCallback = cb;
    return () => {
      authCallback = null;
    };
  },
  signOut: (...args: unknown[]) => mockSignOut(...(args as [])),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ type: 'doc', path: `${col}/${id}` }),
  collection: (_db: unknown, col: string) => ({ type: 'collection', path: col }),
  where: (field: string, op: string, val: unknown) => ({ field, op, val }),
  query: (col: { path: string }) => ({ type: 'query', path: col.path }),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
  onSnapshot: (target: { type: string; path: string }, onNext: unknown) => {
    if (target.type === 'doc' && target.path.startsWith('users/')) {
      userDocSnapshotHandler = onNext as DocSnapshotHandler;
    } else if (target.type === 'query' && target.path === 'users') {
      publicUsersSnapshotHandler = onNext as QuerySnapshotHandler;
    }
    return () => {};
  },
}));

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('./useIsAdmin', () => ({
  useIsAdmin: (user: User | null) => user?.uid === 'admin-uid',
}));

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;
    userDocSnapshotHandler = null;
    publicUsersSnapshotHandler = null;
  });

  it('tracks auth state, initializes missing user profile, syncs public users, and handles friend/privacy updates', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.authLoading).toBe(true);
    expect(result.current.user).toBeNull();

    const mockUser = {
      uid: 'admin-uid',
      displayName: 'Sean',
      email: 'sean@example.com',
    } as User;

    act(() => {
      authCallback?.(mockUser);
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAdmin).toBe(true);

    // When profile doc does not exist yet, it initializes it via setDoc
    await act(async () => {
      userDocSnapshotHandler?.({
        exists: () => false,
        data: () => ({}),
      });
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    // Emit existing profile doc and public users
    act(() => {
      userDocSnapshotHandler?.({
        exists: () => true,
        data: () => ({
          uid: 'admin-uid',
          displayName: 'Sean',
          email: 'sean@example.com',
          isPublic: true,
          friends: ['friend-1'],
        }),
      });
      publicUsersSnapshotHandler?.({
        forEach: (cb) => {
          cb({
            id: 'friend-1',
            data: () => ({ displayName: 'Friend One', email: 'f1@example.com', isPublic: true }),
          });
        },
      });
    });

    expect(result.current.userProfile?.displayName).toBe('Sean');
    expect(result.current.allUsers).toHaveLength(1);
    expect(result.current.allUsers[0].uid).toBe('friend-1');

    // Toggle privacy
    await act(async () => {
      await result.current.togglePrivacy();
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/admin-uid' },
      { isPublic: false }
    );

    // Add friend
    await act(async () => {
      await result.current.addFriend('friend-2');
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/admin-uid' },
      { friends: ['friend-1', 'friend-2'] }
    );

    // Remove friend
    await act(async () => {
      await result.current.removeFriend('friend-1');
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/admin-uid' },
      { friends: [] }
    );

    // Sign out
    await act(async () => {
      await result.current.signOutUser();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
