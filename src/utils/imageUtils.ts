/**
 * Utility functions for image processing, compression, and Firebase Cloud Storage uploads.
 */

import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import type { BeerEvent } from '../types';

/**
 * Checks whether a given string is a base64 Data URL (e.g. data:image/jpeg;base64,...).
 */
export function isBase64DataUrl(urlStr?: string): boolean {
  if (!urlStr) return false;
  return urlStr.trim().startsWith('data:image/');
}

/**
 * Compresses an uploaded image file using an HTML canvas element to a binary Blob.
 * Scales down dimensions to fit within maxWidth / maxHeight while maintaining aspect ratio,
 * and encodes to JPEG with the specified quality.
 */
export async function compressImageToBlob(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Failed to load image element.'));
      };

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate scaling aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const bestRatio = Math.min(widthRatio, heightRatio);

          width = Math.round(width * bestRatio);
          height = Math.round(height * bestRatio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context from canvas.'));
          return;
        }

        // Draw and export compressed JPEG Blob
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image to Blob.'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Empty image payload.'));
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an uploaded image file using an HTML canvas element and returns a base64 data URL.
 * Provided for backward compatibility and local previews.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Failed to load image element.'));
      };

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const bestRatio = Math.min(widthRatio, heightRatio);

          width = Math.round(width * bestRatio);
          height = Math.round(height * bestRatio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context from canvas.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Empty image payload.'));
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image file and uploads it directly to Firebase Cloud Storage.
 * Returns the public HTTPS download URL.
 */
export async function uploadImageFile(
  file: File,
  storagePath: string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8
): Promise<string> {
  const blob = await compressImageToBlob(file, maxWidth, maxHeight, quality);
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
  });
  return getDownloadURL(storageRef);
}

/**
 * Uploads a base64 Data URL to Firebase Cloud Storage and returns the public HTTPS download URL.
 */
export async function uploadBase64Image(dataUrl: string, storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, dataUrl, 'data_url');
  return getDownloadURL(storageRef);
}

/**
 * Sanitizes an image URL: if it is a base64 Data URL, uploads it to Cloud Storage
 * and returns the download URL; if it is already an HTTP/HTTPS URL, returns it untouched.
 */
export async function sanitizeOrUploadImageUrl(
  imageUrl: string | undefined,
  storagePath: string
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  const trimmed = imageUrl.trim();
  if (!trimmed) return undefined;
  if (isBase64DataUrl(trimmed)) {
    return uploadBase64Image(trimmed, storagePath);
  }
  return trimmed;
}

/**
 * Validates whether a given string is a valid HTTP/HTTPS URL or Data URL.
 */
export function isValidImageUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  const trimmed = urlStr.trim();
  if (isBase64DataUrl(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Scans a BeerEvent for any legacy base64 image strings in drinks and reviews,
 * uploads them to Firebase Storage, and returns an updated BeerEvent object.
 */
export async function migrateEventImagesToStorage(
  event: BeerEvent
): Promise<{ updated: boolean; event: BeerEvent }> {
  if (!event.drinks || event.drinks.length === 0) {
    return { updated: false, event };
  }

  let hasChanges = false;
  const updatedDrinks = await Promise.all(
    event.drinks.map(async (drink) => {
      let drinkModified = false;
      let drinkImageUrl = drink.imageUrl;

      if (drinkImageUrl && isBase64DataUrl(drinkImageUrl)) {
        try {
          const path = `events/${event.id}/drinks/${drink.id}.jpg`;
          drinkImageUrl = await uploadBase64Image(drinkImageUrl, path);
          drinkModified = true;
        } catch (err) {
          console.error(`Failed to migrate drink image for ${drink.id}:`, err);
        }
      }

      const updatedReviews = await Promise.all(
        (drink.reviews || []).map(async (review) => {
          let reviewImageUrl = review.imageUrl;
          if (reviewImageUrl && isBase64DataUrl(reviewImageUrl)) {
            try {
              const path = `events/${event.id}/reviews/${review.id}.jpg`;
              reviewImageUrl = await uploadBase64Image(reviewImageUrl, path);
              drinkModified = true;
              return { ...review, imageUrl: reviewImageUrl };
            } catch (err) {
              console.error(`Failed to migrate review image for ${review.id}:`, err);
              return review;
            }
          }
          return review;
        })
      );

      if (drinkModified) {
        hasChanges = true;
        return {
          ...drink,
          imageUrl: drinkImageUrl,
          reviews: updatedReviews,
        };
      }
      return drink;
    })
  );

  if (hasChanges) {
    return {
      updated: true,
      event: {
        ...event,
        drinks: updatedDrinks,
      },
    };
  }

  return { updated: false, event };
}
