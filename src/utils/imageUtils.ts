/**
 * Utility functions for image processing and compression
 */

/**
 * Compresses an uploaded image file using an HTML canvas element.
 * Scales down dimensions to fit within maxWidth / maxHeight while maintaining aspect ratio,
 * and encodes to a JPEG data URL with the specified quality.
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

        // Draw and export compressed JPEG
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
 * Validates whether a given string is a valid HTTP/HTTPS URL or Data URL.
 */
export function isValidImageUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  const trimmed = urlStr.trim();
  if (trimmed.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
