import { describe, it, expect, vi } from 'vitest';
import type { ReviewExportEntry } from '../types';
import {
  buildReviewCsv,
  buildReviewJson,
  buildDiaryCsv,
  formatExportDate,
  generateExportFilename,
  downloadTextFile,
  REVIEW_EXPORT_COLUMNS,
  type DiaryRow,
} from './exportDiary';

describe('exportDiary utils', () => {
  const sampleEntry: ReviewExportEntry = {
    eventId: 'event-1',
    eventName: 'Leeds Craft Festival',
    eventDate: '2026-11-10',
    eventAddress: 'Leeds Corn Exchange',
    eventStatus: 'Upcoming',
    brewery: 'North Brew',
    breweryLocation: 'Leeds',
    drinkId: 'drink-1',
    drinkName: 'Northern Star',
    style: 'Porter',
    type: 'Porter',
    abv: '5.2%',
    caskOrKeg: 'Keg',
    isVegan: true,
    isGlutenFree: false,
    description: 'Rich roasted malt with coffee',
    reviewId: 'rev-1',
    rating: 9.5,
    comment: 'Superb porter with dark chocolate',
    tastingTags: ['Coffee', 'Roasty', 'Chocolate'],
    servingSize: 'Pint',
    price: '£5.50',
    createdAt: '2026-11-05T12:00:00Z',
    imageUrl: 'https://storage.googleapis.com/test.jpg',
  };

  describe('buildReviewCsv', () => {
    it('produces an RFC 4180 CSV with UTF-8 BOM and correct headers', () => {
      const csv = buildReviewCsv([sampleEntry]);

      // Starts with UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true);

      const lines = csv.slice(1).trim().split('\r\n');
      expect(lines).toHaveLength(2); // Header + 1 row

      const headerRow = lines[0];
      REVIEW_EXPORT_COLUMNS.forEach((col) => {
        expect(headerRow).toContain(`"${col.header}"`);
      });

      const dataRow = lines[1];
      expect(dataRow).toContain('"Leeds Craft Festival"');
      expect(dataRow).toContain('"North Brew"');
      expect(dataRow).toContain('"Northern Star"');
      expect(dataRow).toContain('"Coffee; Roasty; Chocolate"');
      expect(dataRow).toContain('"true"'); // isVegan
      expect(dataRow).toContain('"false"'); // isGlutenFree
      expect(dataRow).toContain('"9.5"');
    });

    it('safely escapes quotes and spreadsheet formula injection characters', () => {
      const injectionEntry: ReviewExportEntry = {
        ...sampleEntry,
        comment: '=SUM(A1:A10)',
        drinkName: 'Beer "Double" Trouble',
        isVegan: null,
        isGlutenFree: null,
      };

      const csv = buildReviewCsv([injectionEntry]);
      const dataRow = csv.slice(1).trim().split('\r\n')[1];

      // Formula injection is escaped with leading single quote
      expect(dataRow).toContain(`"'=SUM(A1:A10)"`);
      // Double quotes are doubled per RFC 4180
      expect(dataRow).toContain(`"Beer ""Double"" Trouble"`);
      // Null booleans render as empty quoted strings
      expect(dataRow).toContain('""');
    });
  });

  describe('buildReviewJson', () => {
    it('generates 2-space indented JSON array that deserializes accurately', () => {
      const json = buildReviewJson([sampleEntry]);

      // Check indentation
      expect(json).toContain('  "eventId": "event-1"');
      expect(json).toContain('  "rating": 9.5');

      const parsed = JSON.parse(json) as ReviewExportEntry[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual(sampleEntry);
      expect(parsed[0].rating).toBe(9.5);
      expect(parsed[0].isVegan).toBe(true);
      expect(parsed[0].isGlutenFree).toBe(false);
      expect(parsed[0].tastingTags).toEqual(['Coffee', 'Roasty', 'Chocolate']);
    });
  });

  describe('filename generation and date formatting', () => {
    it('formats dates as YYYY-MM-DD', () => {
      const date = new Date(2026, 10, 8); // Nov 8, 2026
      expect(formatExportDate(date)).toBe('2026-11-08');
    });

    it('generates standard filenames for CSV and JSON', () => {
      const date = new Date(2026, 10, 8);
      expect(generateExportFilename('csv', date)).toBe('keg-swap-reviews-2026-11-08.csv');
      expect(generateExportFilename('json', date)).toBe('keg-swap-reviews-2026-11-08.json');
    });
  });

  describe('legacy buildDiaryCsv', () => {
    it('preserves backwards compatibility for DiaryRow', () => {
      const legacyRow: DiaryRow = {
        beer: 'Northern Star',
        brewery: 'North Brew',
        style: 'Porter',
        event: 'Leeds Craft Festival',
        eventDate: '2026-11-10',
        reviewDate: '2026-11-05T12:00:00Z',
        rating: 9.0,
        servingSize: 'Pint',
        price: '£5.50',
        notes: 'Classic',
      };

      const csv = buildDiaryCsv([legacyRow]);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"Northern Star"');
      expect(csv).toContain('"Classic"');
    });
  });

  describe('downloadTextFile', () => {
    it('creates a blob, triggers an anchor click, and revokes object URL', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      const clickMock = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeSpy = vi.spyOn(HTMLAnchorElement.prototype, 'remove');
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickMock);

      downloadTextFile('keg-swap-reviews-2026-11-08.csv', 'text/csv', 'header,row');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
