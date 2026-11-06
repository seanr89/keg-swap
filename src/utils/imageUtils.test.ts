import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFirebaseStorageUrl, deleteStorageImageIfOwned } from './imageUtils';

const mockDeleteObject = vi.fn(async () => Promise.resolve());
const mockRef = vi.fn((_storage: unknown, path: string) => ({ path }));

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...(args as [unknown, string])),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...(args as [])),
  uploadBytes: vi.fn(),
  uploadString: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('../firebase', () => ({
  storage: {},
}));

describe('imageUtils storage helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFirebaseStorageUrl', () => {
    it('returns true for firebasestorage.googleapis.com URLs', () => {
      expect(
        isFirebaseStorageUrl(
          'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/events%2F1%2Fdrinks%2F2.jpg'
        )
      ).toBe(true);
    });

    it('returns true for firebasestorage.app URLs', () => {
      expect(
        isFirebaseStorageUrl(
          'https://project.firebasestorage.app/v0/b/project/o/reviews%2F3.webp'
        )
      ).toBe(true);
    });

    it('returns false for external image URLs or invalid strings', () => {
      expect(isFirebaseStorageUrl('https://images.unsplash.com/photo-123')).toBe(false);
      expect(isFirebaseStorageUrl('data:image/jpeg;base64,...')).toBe(false);
      expect(isFirebaseStorageUrl('')).toBe(false);
      expect(isFirebaseStorageUrl(undefined)).toBe(false);
      expect(isFirebaseStorageUrl('not a url')).toBe(false);
    });
  });

  describe('deleteStorageImageIfOwned', () => {
    it('calls deleteObject when given a Firebase Storage URL', async () => {
      const storageUrl =
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/events%2F1%2Freviews%2F2.webp';
      await deleteStorageImageIfOwned(storageUrl);

      expect(mockRef).toHaveBeenCalledWith({}, storageUrl);
      expect(mockDeleteObject).toHaveBeenCalledWith({ path: storageUrl });
    });

    it('does not call deleteObject for non-storage URLs', async () => {
      await deleteStorageImageIfOwned('https://example.com/beer.png');
      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it('gracefully handles deletion errors without throwing', async () => {
      mockDeleteObject.mockRejectedValueOnce(new Error('storage/object-not-found'));
      const storageUrl =
        'https://firebasestorage.googleapis.com/v0/b/bucket/o/events%2F1%2Freviews%2F2.webp';

      await expect(deleteStorageImageIfOwned(storageUrl)).resolves.not.toThrow();
    });
  });
});
