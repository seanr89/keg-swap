/**
 * Utilities for generating, validating, normalizing, and deep-linking
 * short shareable Friend Codes (e.g. "KEG-7X9B").
 */

export const FRIEND_CODE_PREFIX = 'KEG-';

/**
 * Unambiguous character set (excludes 0/O and 1/I/L to avoid visual confusion
 * when reading or typing codes in dimly lit venues).
 */
export const FRIEND_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const FRIEND_CODE_SUFFIX_LENGTH = 4;

/**
 * Deterministically derives a canonical `KEG-XXXX` code from a user's UID.
 * Useful for backfilling existing profiles consistently without UI flicker.
 */
export function deriveFriendCodeFromUid(uid: string): string {
  const clean = uid.trim() || 'kegswap-default-uid';
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  let suffix = '';
  let value = hash;
  for (let i = 0; i < FRIEND_CODE_SUFFIX_LENGTH; i++) {
    // Mix additional UID characters per position so all 4 characters have high entropy
    const extra = clean.charCodeAt((i * 7 + i) % clean.length);
    const index = ((value ^ extra) >>> 0) % FRIEND_CODE_ALPHABET.length;
    suffix += FRIEND_CODE_ALPHABET[index];
    value = Math.imul(value ^ (i + 1), 2246822519) >>> 0;
  }

  return `${FRIEND_CODE_PREFIX}${suffix}`;
}

/**
 * Generates a new canonical Friend Code (`KEG-XXXX`).
 * If a `seedUid` is provided, derives it deterministically; otherwise uses cryptographic randomness.
 */
export function generateFriendCode(seedUid?: string): string {
  if (seedUid) {
    return deriveFriendCodeFromUid(seedUid);
  }

  const randomValues = new Uint32Array(FRIEND_CODE_SUFFIX_LENGTH);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < FRIEND_CODE_SUFFIX_LENGTH; i++) {
      randomValues[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }

  let suffix = '';
  for (let i = 0; i < FRIEND_CODE_SUFFIX_LENGTH; i++) {
    suffix += FRIEND_CODE_ALPHABET[randomValues[i] % FRIEND_CODE_ALPHABET.length];
  }

  return `${FRIEND_CODE_PREFIX}${suffix}`;
}

/**
 * Normalizes user-entered or scanned code text into canonical `KEG-XXXX` uppercase form.
 * Accepts inputs with or without the `KEG-` prefix (e.g., `"7x9b"`, `"keg7x9b"`, `"keg-7x9b"`).
 */
export function normalizeFriendCode(rawInput: string): string {
  const cleaned = rawInput.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith(FRIEND_CODE_PREFIX)) {
    return cleaned;
  }

  // Handle "KEG7X9B" (missing hyphen)
  if (cleaned.startsWith('KEG') && /^[A-Z0-9]{4,8}$/.test(cleaned.slice(3))) {
    return `${FRIEND_CODE_PREFIX}${cleaned.slice(3)}`;
  }

  // Handle bare suffix like "7X9B"
  if (/^[A-Z0-9]{4,8}$/.test(cleaned)) {
    return `${FRIEND_CODE_PREFIX}${cleaned}`;
  }

  return cleaned;
}

/**
 * Checks whether a string is a valid canonical Friend Code (`KEG-XXXX` to `KEG-XXXXXXXX`).
 */
export function isValidFriendCode(code: string): boolean {
  return /^KEG-[A-Z0-9]{4,8}$/.test(code);
}

/**
 * Extracts and validates a Friend Code from a URL or query string (`?addFriend=KEG-7X9B` or `?friendCode=KEG-7X9B`).
 */
export function extractFriendCodeFromUrl(urlOrSearch: string): string | null {
  const trimmed = urlOrSearch.trim();
  if (!trimmed) return null;

  try {
    let searchParams: URLSearchParams;
    if (trimmed.startsWith('?')) {
      searchParams = new URLSearchParams(trimmed);
    } else if (trimmed.includes('://') || trimmed.startsWith('http')) {
      const parsed = new URL(trimmed);
      searchParams = parsed.searchParams;
    } else if (trimmed.includes('?')) {
      const queryPart = trimmed.slice(trimmed.indexOf('?'));
      searchParams = new URLSearchParams(queryPart);
    } else {
      return null;
    }

    const rawCode = searchParams.get('addFriend') || searchParams.get('friendCode');
    if (!rawCode) return null;

    const normalized = normalizeFriendCode(rawCode);
    return isValidFriendCode(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Parses a QR scan payload or manual user input (which may be either a full invite URL or a raw code)
 * into a validated canonical Friend Code (`KEG-XXXX`), or `null` if invalid.
 */
export function parseScannedFriendPayload(rawPayload: string): string | null {
  const trimmed = rawPayload.trim();
  if (!trimmed) return null;

  const fromUrl = extractFriendCodeFromUrl(trimmed);
  if (fromUrl) return fromUrl;

  const normalized = normalizeFriendCode(trimmed);
  return isValidFriendCode(normalized) ? normalized : null;
}

/**
 * Builds a canonical shareable deep-link URL for adding a friend by code.
 */
export function buildFriendInviteUrl(friendCode: string, baseOrigin?: string): string {
  const normalized = normalizeFriendCode(friendCode);
  const defaultBase =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://kegswap.app/';
  const base = (baseOrigin ?? defaultBase).replace(/\?.*$/, '').replace(/#.*$/, '');
  const normalizedBase = base.endsWith('.html') ? base : `${base.replace(/\/+$/, '')}/`;
  return `${normalizedBase}?addFriend=${encodeURIComponent(normalized)}`;
}
