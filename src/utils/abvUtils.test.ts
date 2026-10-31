import { describe, it, expect } from 'vitest';
import { parseAbv, getAbvBracket, ABV_BRACKETS } from './abvUtils';

describe('abvUtils', () => {
  describe('parseAbv', () => {
    it('parses valid percentage strings into numbers', () => {
      expect(parseAbv('4.5%')).toBe(4.5);
      expect(parseAbv(' 6.2 % ')).toBe(6.2);
      expect(parseAbv('12%')).toBe(12);
      expect(parseAbv('0%')).toBe(0);
      expect(parseAbv('5.8')).toBe(5.8);
    });

    it('returns null for non-numeric or negative values', () => {
      expect(parseAbv('N/A')).toBeNull();
      expect(parseAbv('')).toBeNull();
      expect(parseAbv('abc%')).toBeNull();
      expect(parseAbv('-5.0%')).toBeNull();
    });
  });

  describe('getAbvBracket', () => {
    it('categorizes low / session ABV (< 4.0%)', () => {
      expect(getAbvBracket('0%')).toBe('low');
      expect(getAbvBracket('3.5%')).toBe('low');
      expect(getAbvBracket('3.99%')).toBe('low');
    });

    it('categorizes mid-range ABV (4.0% - 5.9%)', () => {
      expect(getAbvBracket('4.0%')).toBe('mid');
      expect(getAbvBracket('5.0%')).toBe('mid');
      expect(getAbvBracket('5.9%')).toBe('mid');
    });

    it('categorizes strong ABV (6.0% - 8.5%)', () => {
      expect(getAbvBracket('6.0%')).toBe('strong');
      expect(getAbvBracket('7.5%')).toBe('strong');
      expect(getAbvBracket('8.5%')).toBe('strong');
    });

    it('categorizes imperial / high gravity ABV (> 8.5%)', () => {
      expect(getAbvBracket('8.51%')).toBe('imperial');
      expect(getAbvBracket('10.2%')).toBe('imperial');
      expect(getAbvBracket('15.0%')).toBe('imperial');
    });

    it('returns null for unparseable strings', () => {
      expect(getAbvBracket('invalid')).toBeNull();
      expect(getAbvBracket('')).toBeNull();
    });

    it('covers all bracket definitions with non-empty labels', () => {
      expect(ABV_BRACKETS).toHaveLength(4);
      ABV_BRACKETS.forEach((bracket) => {
        expect(bracket.label).toBeTruthy();
        expect(typeof bracket.matches).toBe('function');
      });
    });
  });
});
