import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useAuth } from './useAuth';

let authCallback: ((user: User | null) => void) | null = null;
const mockSignOut = vi.fn(async () => Promise.resolve());
const mockSetDoc = vi.fn(async () => Promise.resolve());
const mockUpdateDoc = vi.fn(async () => Promise.resolve());
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();

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
  arrayUnion: (...vals: unknown[]) => ({ __op: 'arrayUnion', vals }),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
  getDoc: (...args: unknown[]) => mockGetDoc(...(args as [])),
  getDocs: (...args: unknown[]) => mockGetDocs(...(args as [])),
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

    // When profile doc does not exist yet, it initializes it via setDoc (including friendCode)
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
          friendCode: 'KEG-SEAN',
        }),
      });
      publicUsersSnapshotHandler?.({
        forEach: (cb) => {
          cb({
            id: 'friend-1',
            data: () => ({
              displayName: 'Friend One',
              email: 'f1@example.com',
              isPublic: true,
              friendCode: 'KEG-FRN1',
            }),
          });
        },
      });
    });

    expect(result.current.userProfile?.displayName).toBe('Sean');
    expect(result.current.userProfile?.friendCode).toBe('KEG-SEAN');
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

  it('resolves private and public friends by friendCode and connects mutually via addFriendByCode', async () => {
    const { result } = renderHook(() => useAuth());

    const mockUser = {
      uid: 'user-a',
      displayName: 'Alice',
      email: 'alice@example.com',
    } as User;

    act(() => {
      authCallback?.(mockUser);
    });

    act(() => {
      userDocSnapshotHandler?.({
        exists: () => true,
        data: () => ({
          uid: 'user-a',
          displayName: 'Alice',
          email: 'alice@example.com',
          isPublic: true,
          friends: [],
          friendCode: 'KEG-ALCE',
        }),
      });
    });

    // Sync friend code directory
    await act(async () => {
      const code = await result.current.syncFriendCode();
      expect(code).toBe('KEG-ALCE');
    });
    expect(mockSetDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'friendCodes/KEG-ALCE' },
      expect.objectContaining({
        uid: 'user-a',
        displayName: 'Alice',
        friendCode: 'KEG-ALCE',
      })
    );

    // Lookup private user via /friendCodes/KEG-PRIV
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'user-private',
        displayName: 'Secret Brewer',
        email: 'secret@example.com',
        friendCode: 'KEG-PRIV',
        updatedAt: '2026-11-04T00:00:00Z',
      }),
    });

    let addResult: Awaited<ReturnType<typeof result.current.addFriendByCode>> | undefined;
    await act(async () => {
      addResult = await result.current.addFriendByCode('7x9b'.replace('7x9b', 'keg-priv'));
    });

    expect(addResult?.status).toBe('added');
    expect(addResult?.profile?.uid).toBe('user-private');
    expect(addResult?.profile?.displayName).toBe('Secret Brewer');

    // Should update both user-a's friends and user-private's friends (mutual connection)
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/user-a' },
      { friends: ['user-private'] }
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { type: 'doc', path: 'users/user-private' },
      { friends: { __op: 'arrayUnion', vals: ['user-a'] } }
    );

    // Private friend profile is now merged into allUsers for profile display
    expect(result.current.allUsers.some((u) => u.uid === 'user-private')).toBe(true);
  });
});
