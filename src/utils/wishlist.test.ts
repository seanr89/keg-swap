import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MAX_TOP_FIVE,
  computeMoveTopFive,
  computeSwapTopFive,
  computeToggleTopFive,
  normalizeTopFiveIds,
  setTopFiveDrinks,
  setWishlisted,
} from './wishlist';
import { countMatching, matchesShowFilter } from './showFilter';

const mockSetDoc = vi.fn(async () => Promise.resolve());
const mockDoc = vi.fn((_db, ...segments: string[]) => ({ path: segments.join('/') }));
const mockArrayUnion = vi.fn((val: string) => ({ __op: 'arrayUnion', val }));
const mockArrayRemove = vi.fn((val: string) => ({ __op: 'arrayRemove', val }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, ...string[]])),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  arrayUnion: (val: string) => mockArrayUnion(val),
  arrayRemove: (val: string) => mockArrayRemove(val),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

describe('wishlist and Top 5 utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeTopFiveIds', () => {
    it('returns an empty array for undefined or empty input', () => {
      expect(normalizeTopFiveIds(undefined)).toEqual([]);
      expect(normalizeTopFiveIds([])).toEqual([]);
    });

    it('deduplicates, trims, and caps at MAX_TOP_FIVE (5)', () => {
      const raw = [' d1 ', 'd2', 'd1', '', 'd3', 'd4', 'd5', 'd6', 'd7'];
      const normalized = normalizeTopFiveIds(raw);
      expect(normalized).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
      expect(normalized).toHaveLength(MAX_TOP_FIVE);
    });

    it('filters out drink IDs that are not present in validDrinkIds', () => {
      const validIds = new Set(['d1', 'd3', 'd5']);
      const normalized = normalizeTopFiveIds(['d1', 'd2', 'd3', 'd4', 'd5'], validIds);
      expect(normalized).toEqual(['d1', 'd3', 'd5']);
    });
  });

  describe('computeToggleTopFive', () => {
    it('adds a drink when fewer than 5 drinks are selected', () => {
      const result = computeToggleTopFive(['d1', 'd2'], 'd3');
      expect(result).toEqual({
        nextIds: ['d1', 'd2', 'd3'],
        action: 'added',
      });
    });

    it('removes a drink when it is already in the Top 5', () => {
      const result = computeToggleTopFive(['d1', 'd2', 'd3'], 'd2');
      expect(result).toEqual({
        nextIds: ['d1', 'd3'],
        action: 'removed',
      });
    });

    it('returns limit-reached without modifying the list when already at 5 drinks', () => {
      const current = ['d1', 'd2', 'd3', 'd4', 'd5'];
      const result = computeToggleTopFive(current, 'd6');
      expect(result).toEqual({
        nextIds: ['d1', 'd2', 'd3', 'd4', 'd5'],
        action: 'limit-reached',
      });
    });
  });

  describe('computeSwapTopFive', () => {
    it('replaces the target drink at its exact rank position', () => {
      const current = ['d1', 'd2', 'd3', 'd4', 'd5'];
      const swapped = computeSwapTopFive(current, 'd3', 'd6');
      expect(swapped).toEqual(['d1', 'd2', 'd6', 'd4', 'd5']);
    });

    it('replaces the last slot if removeDrinkId is not found when at capacity', () => {
      const current = ['d1', 'd2', 'd3', 'd4', 'd5'];
      const swapped = computeSwapTopFive(current, 'unknown-id', 'd6');
      expect(swapped).toEqual(['d1', 'd2', 'd3', 'd4', 'd6']);
    });
  });

  describe('computeMoveTopFive', () => {
    it('reorders a drink between valid rank positions', () => {
      const current = ['d1', 'd2', 'd3', 'd4'];
      expect(computeMoveTopFive(current, 2, 0)).toEqual(['d3', 'd1', 'd2', 'd4']);
      expect(computeMoveTopFive(current, 0, 2)).toEqual(['d2', 'd3', 'd1', 'd4']);
    });

    it('leaves the order unchanged for out-of-bounds or identical indices', () => {
      const current = ['d1', 'd2', 'd3'];
      expect(computeMoveTopFive(current, -1, 1)).toEqual(current);
      expect(computeMoveTopFive(current, 0, 5)).toEqual(current);
      expect(computeMoveTopFive(current, 1, 1)).toEqual(current);
    });
  });

  describe('Firestore persistence helpers', () => {
    it('persists topFiveDrinkIds and also unions added drink into general wishlist', async () => {
      await setTopFiveDrinks('user-1', 'event-1', ['d1', 'd2'], 'd2');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const [ref, payload, options] = mockSetDoc.mock.calls[0] as unknown as [
        { path: string },
        Record<string, unknown>,
        Record<string, unknown>
      ];
      expect(ref.path).toBe('users/user-1/wishlists/event-1');
      expect(payload.topFiveDrinkIds).toEqual(['d1', 'd2']);
      expect(payload.drinkIds).toEqual({ __op: 'arrayUnion', val: 'd2' });
      expect(options).toEqual({ merge: true });
    });

    it('updates general wishlist with setWishlisted', async () => {
      await setWishlisted('user-1', 'event-1', 'd4', true);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('showFilter with top5', () => {
    const sampleDrinks = [
      { id: 'd1', reviews: [{ id: 'r1', reviewer: 'Alice', rating: 8.5, comment: '', createdAt: '', userId: 'u1' }] },
      { id: 'd2', reviews: [] },
      { id: 'd3', reviews: [] },
    ];
    const wishlist = new Set(['d1', 'd2', 'd3']);
    const topFive = new Set(['d1', 'd3', 'deleted-drink-id']);

    it('matches only drinks in the topFive set when filter is top5', () => {
      expect(matchesShowFilter(sampleDrinks[0], 'top5', 'u1', wishlist, topFive)).toBe(true);
      expect(matchesShowFilter(sampleDrinks[1], 'top5', 'u1', wishlist, topFive)).toBe(false);
      expect(matchesShowFilter(sampleDrinks[2], 'top5', 'u1', wishlist, topFive)).toBe(true);
    });

    it('counts only existing drinks in the event that match top5', () => {
      expect(countMatching(sampleDrinks, 'top5', 'u1', wishlist, topFive)).toBe(2);
    });
  });
});
