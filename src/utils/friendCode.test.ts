import { describe, it, expect } from 'vitest';
import {
  FRIEND_CODE_PREFIX,
  buildFriendInviteUrl,
  deriveFriendCodeFromUid,
  extractFriendCodeFromUrl,
  generateFriendCode,
  isValidFriendCode,
  normalizeFriendCode,
  parseScannedFriendPayload,
} from './friendCode';
import { buildQrSvgPath, generateQrMatrix } from './qrCode';

describe('friendCode utilities', () => {
  it('derives a deterministic canonical KEG-XXXX code from a UID', () => {
    const code1 = deriveFriendCodeFromUid('user-uid-12345');
    const code2 = deriveFriendCodeFromUid('user-uid-12345');
    const other = deriveFriendCodeFromUid('user-uid-67890');

    expect(code1).toBe(code2);
    expect(code1).not.toBe(other);
    expect(code1.startsWith(FRIEND_CODE_PREFIX)).toBe(true);
    expect(isValidFriendCode(code1)).toBe(true);
    expect(code1).toHaveLength(8);
  });

  it('generates valid random or seeded friend codes without ambiguous characters', () => {
    const randomCode = generateFriendCode();
    expect(isValidFriendCode(randomCode)).toBe(true);
    expect(randomCode).toMatch(/^KEG-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);

    const seededCode = generateFriendCode('uid-abc');
    expect(seededCode).toBe(deriveFriendCodeFromUid('uid-abc'));
  });

  it('normalizes user-typed friend codes flexibly', () => {
    expect(normalizeFriendCode('keg-7x9b')).toBe('KEG-7X9B');
    expect(normalizeFriendCode('  7x9b  ')).toBe('KEG-7X9B');
    expect(normalizeFriendCode('keg7x9b')).toBe('KEG-7X9B');
    expect(normalizeFriendCode('KEG - 9X2M')).toBe('KEG-9X2M');
    expect(normalizeFriendCode('')).toBe('');
  });

  it('validates canonical friend codes', () => {
    expect(isValidFriendCode('KEG-7X9B')).toBe(true);
    expect(isValidFriendCode('KEG-9X2M4P')).toBe(true);
    expect(isValidFriendCode('7X9B')).toBe(false);
    expect(isValidFriendCode('KEG-12')).toBe(false);
    expect(isValidFriendCode('INVALID-CODE-TOO-LONG')).toBe(false);
  });

  it('builds and extracts friend codes from invite URLs and query strings', () => {
    const url = buildFriendInviteUrl('7x9b', 'https://kegswap.app/');
    expect(url).toBe('https://kegswap.app/?addFriend=KEG-7X9B');

    expect(extractFriendCodeFromUrl(url)).toBe('KEG-7X9B');
    expect(extractFriendCodeFromUrl('?addFriend=keg-9x2m')).toBe('KEG-9X2M');
    expect(extractFriendCodeFromUrl('?friendCode=7x9b')).toBe('KEG-7X9B');
    expect(extractFriendCodeFromUrl('https://kegswap.app/?other=1')).toBeNull();
    expect(extractFriendCodeFromUrl('')).toBeNull();
  });

  it('parses both full QR invite URLs and raw short codes in parseScannedFriendPayload', () => {
    expect(parseScannedFriendPayload('https://kegswap.app/?addFriend=KEG-7X9B')).toBe('KEG-7X9B');
    expect(parseScannedFriendPayload('keg-9x2m')).toBe('KEG-9X2M');
    expect(parseScannedFriendPayload('7x9b')).toBe('KEG-7X9B');
    expect(parseScannedFriendPayload('https://example.com/unrelated')).toBeNull();
    expect(parseScannedFriendPayload('!@#$')).toBeNull();
  });
});

describe('qrCode generator utilities', () => {
  it('generates a square ISO/IEC 18004 QR matrix with intact finder patterns and SVG path', () => {
    const inviteUrl = 'https://kegswap.app/?addFriend=KEG-7X9B';
    const matrix = generateQrMatrix(inviteUrl);

    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);

    // Top-left 7x7 finder pattern corners and center should be dark (true)
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[6][6]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    // Inner ring of finder pattern (1,1) should be light (false)
    expect(matrix[1][1]).toBe(false);

    const svg = buildQrSvgPath(matrix, 4);
    expect(svg.viewBoxSize).toBe(matrix.length + 8);
    expect(svg.pathData).toContain('M4,4h1v1h-1z');
  });
});
