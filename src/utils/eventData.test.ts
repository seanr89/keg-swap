import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteReview } from './eventData';

const mockDeleteDoc = vi.fn(async () => Promise.resolve());
const mockDeleteStorageImageIfOwned = vi.fn(async () => Promise.resolve());

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  collectionGroup: (_db: unknown, name: string) => ({ path: name }),
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...(args as [])),
  deleteField: () => ({}),
  getDocs: vi.fn(async () => ({ docs: [], empty: true })),
  increment: (val: number) => val,
  query: (ref: unknown) => ref,
  setDoc: vi.fn(async () => Promise.resolve()),
  updateDoc: vi.fn(async () => Promise.resolve()),
  where: () => ({}),
  writeBatch: () => ({
    delete: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => Promise.resolve()),
  }),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('./imageUtils', () => ({
  deleteStorageImageIfOwned: (...args: unknown[]) => mockDeleteStorageImageIfOwned(...(args as [])),
  migrateEventImagesToStorage: vi.fn(async (e: unknown) => ({ updated: false, event: e })),
}));

describe('eventData deleteReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the review document and triggers storage image cleanup', async () => {
    await deleteReview(
      'event-123',
      'drink-456',
      'review-789',
      'https://firebasestorage.googleapis.com/v0/b/app/o/rev.webp'
    );

    expect(mockDeleteDoc).toHaveBeenCalledWith({
      path: 'events/event-123/drinks/drink-456/reviews/review-789',
    });
    expect(mockDeleteStorageImageIfOwned).toHaveBeenCalledWith(
      'https://firebasestorage.googleapis.com/v0/b/app/o/rev.webp'
    );
  });
});
