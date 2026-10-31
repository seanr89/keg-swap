import { describe, it, expect, vi } from 'vitest';
import { clampAndSnapRating, getRatingSentiment, triggerHapticTick } from './ratingUtils';

describe('ratingUtils', () => {
  describe('clampAndSnapRating', () => {
    it('snaps ratings to the nearest 0.5 increment', () => {
      expect(clampAndSnapRating(7.1)).toBe(7.0);
      expect(clampAndSnapRating(7.24)).toBe(7.0);
      expect(clampAndSnapRating(7.26)).toBe(7.5);
      expect(clampAndSnapRating(7.74)).toBe(7.5);
      expect(clampAndSnapRating(7.8)).toBe(8.0);
    });

    it('clamps ratings below 0.5 up to 0.5', () => {
      expect(clampAndSnapRating(0.1)).toBe(0.5);
      expect(clampAndSnapRating(-3)).toBe(0.5);
    });

    it('clamps ratings above 10.0 down to 10.0', () => {
      expect(clampAndSnapRating(10.5)).toBe(10.0);
      expect(clampAndSnapRating(25.0)).toBe(10.0);
    });

    it('defaults NaN to 8.0', () => {
      expect(clampAndSnapRating(Number.NaN)).toBe(8.0);
    });
  });

  describe('getRatingSentiment', () => {
    it('returns correct sentiments and tiers across all score brackets', () => {
      expect(getRatingSentiment(1.5)).toEqual({
        label: 'Flawed / Undrinkable',
        subtext: 'Off-flavors or drain pour',
        tier: 'low',
      });

      expect(getRatingSentiment(2.5)).toEqual({
        label: 'Flawed / Undrinkable',
        subtext: 'Off-flavors or drain pour',
        tier: 'low',
      });

      expect(getRatingSentiment(3.5)).toEqual({
        label: 'Below Average',
        subtext: 'Missing the mark',
        tier: 'below',
      });

      expect(getRatingSentiment(4.5)).toEqual({
        label: 'Below Average',
        subtext: 'Missing the mark',
        tier: 'below',
      });

      expect(getRatingSentiment(5.5)).toEqual({
        label: 'Solid / Sessionable',
        subtext: 'Decent, easy drinking',
        tier: 'solid',
      });

      expect(getRatingSentiment(6.5)).toEqual({
        label: 'Solid / Sessionable',
        subtext: 'Decent, easy drinking',
        tier: 'solid',
      });

      expect(getRatingSentiment(7.5)).toEqual({
        label: 'Great / Very Good',
        subtext: 'Well-crafted & enjoyable',
        tier: 'great',
      });

      expect(getRatingSentiment(8.0)).toEqual({
        label: 'Great / Very Good',
        subtext: 'Well-crafted & enjoyable',
        tier: 'great',
      });

      expect(getRatingSentiment(8.5)).toEqual({
        label: 'Outstanding',
        subtext: 'Standout festival pour',
        tier: 'outstanding',
      });

      expect(getRatingSentiment(9.0)).toEqual({
        label: 'Outstanding',
        subtext: 'Standout festival pour',
        tier: 'outstanding',
      });

      expect(getRatingSentiment(9.5)).toEqual({
        label: 'World Class',
        subtext: 'Unforgettable masterpiece',
        tier: 'world-class',
      });

      expect(getRatingSentiment(10.0)).toEqual({
        label: 'World Class',
        subtext: 'Unforgettable masterpiece',
        tier: 'world-class',
      });
    });
  });

  describe('triggerHapticTick', () => {
    it('calls navigator.vibrate when available', () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        configurable: true,
        writable: true,
      });

      triggerHapticTick(10);
      expect(vibrateMock).toHaveBeenCalledWith(10);

      // Default duration is 6ms
      triggerHapticTick();
      expect(vibrateMock).toHaveBeenCalledWith(6);
    });

    it('silently catches any vibration exceptions', () => {
      Object.defineProperty(navigator, 'vibrate', {
        value: () => {
          throw new Error('Denied');
        },
        configurable: true,
        writable: true,
      });

      expect(() => triggerHapticTick()).not.toThrow();
    });
  });
});
