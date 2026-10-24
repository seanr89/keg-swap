import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SAMPLE_TEST_BEERS,
  SAMPLE_TEST_EVENT,
  generateDrinkId,
  seedTestEventWithDrinks,
} from './testEventSeeder';
import { parseBatchBeerJson } from './batchBeerParser';
import testBeersJson from '../../test_beers.json';

// Mock Firestore operations
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts) => parts.join('/')),
  addDoc: vi.fn(async (_col, data) => ({ id: 'mock-test-event-id', ...data })),
  doc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('./eventData', () => ({
  addDrinks: vi.fn(async () => Promise.resolve()),
  deleteEventCascade: vi.fn(async () => Promise.resolve()),
}));

describe('testEventSeeder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SAMPLE_TEST_BEERS dataset', () => {
    it('contains exactly 10 diverse test beers', () => {
      expect(SAMPLE_TEST_BEERS).toHaveLength(10);
    });

    it('ensures each test beer has all required non-empty string fields', () => {
      SAMPLE_TEST_BEERS.forEach((beer) => {
        expect(beer.name.trim().length).toBeGreaterThan(0);
        expect(beer.brewery.trim().length).toBeGreaterThan(0);
        expect(beer.location.trim().length).toBeGreaterThan(0);
        expect(beer.style.trim().length).toBeGreaterThan(0);
        expect(beer.description.trim().length).toBeGreaterThan(0);
        expect(beer.abv).toMatch(/^\d+(\.\d+)?%$/);
      });
    });

    it('contains varied styles, serving types, and dietary classifications', () => {
      const styles = new Set(SAMPLE_TEST_BEERS.map((b) => b.style));
      expect(styles.size).toBeGreaterThanOrEqual(6);
      expect(styles.has('Pale Ale')).toBe(true);
      expect(styles.has('Porter')).toBe(true);
      expect(styles.has('IPA')).toBe(true);
      expect(styles.has('Stout')).toBe(true);
      expect(styles.has('Sour')).toBe(true);
      expect(styles.has('Lager')).toBe(true);

      const veganBeers = SAMPLE_TEST_BEERS.filter((b) => b.isVegan === true);
      const glutenFreeBeers = SAMPLE_TEST_BEERS.filter((b) => b.isGlutenFree === true);
      const caskBeers = SAMPLE_TEST_BEERS.filter((b) => b.caskOrKeg === 'Cask');
      const kegBeers = SAMPLE_TEST_BEERS.filter((b) => b.caskOrKeg === 'Keg');

      expect(veganBeers.length).toBeGreaterThan(0);
      expect(glutenFreeBeers.length).toBeGreaterThan(0);
      expect(caskBeers.length).toBeGreaterThan(0);
      expect(kegBeers.length).toBeGreaterThan(0);
    });
  });

  describe('test_beers.json file verification', () => {
    it('parses cleanly via parseBatchBeerJson with 10 valid records and 0 skipped', () => {
      const fileContent = JSON.stringify(testBeersJson);
      const result = parseBatchBeerJson(fileContent);

      expect(result.error).toBeUndefined();
      expect(result.validDrinks).toHaveLength(10);
      expect(result.skippedCount).toBe(0);
    });
  });

  describe('generateDrinkId', () => {
    it('generates unique non-empty string identifiers', () => {
      const id1 = generateDrinkId();
      const id2 = generateDrinkId();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);
    });
  });

  describe('seedTestEventWithDrinks', () => {
    it('creates a test event and batch-inserts the 10 test beers', async () => {
      const { addDoc } = await import('firebase/firestore');
      const { addDrinks } = await import('./eventData');

      const result = await seedTestEventWithDrinks('test-user-uid');

      expect(result).toEqual({
        eventId: 'mock-test-event-id',
        drinkCount: 10,
      });

      expect(addDoc).toHaveBeenCalledTimes(1);
      const addedEventPayload = vi.mocked(addDoc).mock.calls[0][1];
      expect(addedEventPayload).toMatchObject({
        name: SAMPLE_TEST_EVENT.name,
        date: SAMPLE_TEST_EVENT.date,
        address: SAMPLE_TEST_EVENT.address,
        status: 'Upcoming',
        drinkCount: 0,
        userId: 'test-user-uid',
      });

      expect(addDrinks).toHaveBeenCalledTimes(1);
      const [calledEventId, calledDrinks] = vi.mocked(addDrinks).mock.calls[0];
      expect(calledEventId).toBe('mock-test-event-id');
      expect(calledDrinks).toHaveLength(10);
      calledDrinks.forEach((drink) => {
        expect(drink.id).toBeDefined();
        expect(drink.reviews).toEqual([]);
      });
    });

    it('allows overriding event properties when seeding', async () => {
      const { addDoc } = await import('firebase/firestore');

      await seedTestEventWithDrinks('tester-1', {
        name: 'Custom Test Festival 2026',
        status: 'Ongoing',
      });

      const addedEventPayload = vi.mocked(addDoc).mock.calls[0][1];
      expect(addedEventPayload).toMatchObject({
        name: 'Custom Test Festival 2026',
        status: 'Ongoing',
        userId: 'tester-1',
      });
    });
  });
});
