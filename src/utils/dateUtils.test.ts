import { describe, it, expect } from 'vitest';
import { parseLocalDate } from './dateUtils';

describe('dateUtils', () => {
  describe('parseLocalDate', () => {
    it('parses YYYY-MM-DD date strings in local time', () => {
      const parsed = parseLocalDate('2026-10-31');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9); // 0-indexed: October is 9
      expect(parsed.getDate()).toBe(31);
    });

    it('correctly handles month boundaries and leap day', () => {
      const leapDay = parseLocalDate('2028-02-29');
      expect(leapDay.getFullYear()).toBe(2028);
      expect(leapDay.getMonth()).toBe(1); // February is 1
      expect(leapDay.getDate()).toBe(29);

      const newYear = parseLocalDate('2027-01-01');
      expect(newYear.getFullYear()).toBe(2027);
      expect(newYear.getMonth()).toBe(0);
      expect(newYear.getDate()).toBe(1);
    });

    it('falls back to standard Date parsing when format does not match YYYY-MM-DD', () => {
      const isoString = '2026-05-15T12:00:00Z';
      const parsed = parseLocalDate(isoString);
      expect(parsed.getTime()).toBe(new Date(isoString).getTime());
    });
  });
});
