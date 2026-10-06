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

// WebP at ~0.75 is roughly 60% smaller than the JPEG 0.8 / 1000px this replaced.
export const IMAGE_MAX_DIMENSION = 600;
export const IMAGE_QUALITY = 0.75;

const PREFERRED_IMAGE_TYPE = 'image/webp';
const FALLBACK_IMAGE_TYPE = 'image/jpeg';

function extensionForMime(mime: string): string {
  return mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
}

/** Swaps a storage path's extension for the one matching the actual encoded format. */
function withImageExtension(storagePath: string, mime: string): string {
  return storagePath.replace(/\.[A-Za-z0-9]+$/, '') + '.' + extensionForMime(mime);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('Empty image payload.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element.'));
      img.onload = () => resolve(img);
      img.src = e.target.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Compresses an uploaded image file using an HTML canvas element to a binary Blob.
 * Scales down dimensions to fit within maxWidth / maxHeight while maintaining aspect ratio,
 * and encodes to WebP. Browsers that cannot encode WebP (older Safari silently returns PNG)
 * fall back to JPEG; check `blob.type` for the format actually produced.
 */
export async function compressImageToBlob(
  file: File,
  maxWidth = IMAGE_MAX_DIMENSION,
  maxHeight = IMAGE_MAX_DIMENSION,
  quality = IMAGE_QUALITY
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  const img = await loadImage(file);

  let width = img.width;
  let height = img.height;
  if (width > maxWidth || height > maxHeight) {
    const bestRatio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * bestRatio);
    height = Math.round(height * bestRatio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas.');
  }
  ctx.drawImage(img, 0, 0, width, height);

  const webp = await canvasToBlob(canvas, PREFERRED_IMAGE_TYPE, quality);
  if (webp && webp.type === PREFERRED_IMAGE_TYPE) return webp;

  const jpeg = await canvasToBlob(canvas, FALLBACK_IMAGE_TYPE, quality);
  if (!jpeg) {
    throw new Error('Failed to compress image to Blob.');
  }
  return jpeg;
}

/**
 * Compresses an uploaded image file and returns a base64 data URL.
 * Provided for backward compatibility and local previews.
 */
export async function compressImageFile(
  file: File,
  maxWidth = IMAGE_MAX_DIMENSION,
  maxHeight = IMAGE_MAX_DIMENSION,
  quality = IMAGE_QUALITY
): Promise<string> {
  const blob = await compressImageToBlob(file, maxWidth, maxHeight, quality);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read compressed image.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses an image file and uploads it directly to Firebase Cloud Storage.
 * The path's extension is replaced to match the encoded format.
 * Returns the public HTTPS download URL.
 */
export async function uploadImageFile(
  file: File,
  storagePath: string,
  maxWidth = IMAGE_MAX_DIMENSION,
  maxHeight = IMAGE_MAX_DIMENSION,
  quality = IMAGE_QUALITY
): Promise<string> {
  const blob = await compressImageToBlob(file, maxWidth, maxHeight, quality);
  const storageRef = ref(storage, withImageExtension(storagePath, blob.type));
  await uploadBytes(storageRef, blob, {
    contentType: blob.type,
  });
  return getDownloadURL(storageRef);
}

/**
 * Uploads a base64 Data URL to Firebase Cloud Storage and returns the public HTTPS download URL.
 */
export async function uploadBase64Image(dataUrl: string, storagePath: string): Promise<string> {
  const mime = /^data:(image\/[A-Za-z0-9.+-]+)/.exec(dataUrl.trim())?.[1] ?? FALLBACK_IMAGE_TYPE;
  const storageRef = ref(storage, withImageExtension(storagePath, mime));
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
