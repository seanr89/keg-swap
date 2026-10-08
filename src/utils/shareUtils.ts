export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareContent {
  title: string;
  text: string;
  url: string;
}

/** The app root, without query string or hash (there are no per-item URLs yet). */
export function getAppShareUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Shares via the native share sheet when the browser has one, otherwise copies the link
 * (with its text) to the clipboard. Dismissing the share sheet is `'cancelled'`, not an error.
 */
export async function shareLink({ title, text, url }: ShareContent): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other share failure falls through to the clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
