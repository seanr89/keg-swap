import type { ReviewExportEntry } from '../types';

export interface DiaryRow {
  beer: string;
  brewery: string;
  style: string;
  event: string;
  eventDate: string;
  reviewDate: string;
  rating: number;
  servingSize: string;
  price: string;
  notes: string;
}

const DIARY_COLUMNS: { header: string; value: (row: DiaryRow) => string }[] = [
  { header: 'Beer', value: (r) => r.beer },
  { header: 'Brewery', value: (r) => r.brewery },
  { header: 'Style', value: (r) => r.style },
  { header: 'Event', value: (r) => r.event },
  { header: 'Event date', value: (r) => r.eventDate },
  { header: 'Review date', value: (r) => r.reviewDate },
  { header: 'Rating', value: (r) => String(r.rating) },
  { header: 'Serving size', value: (r) => r.servingSize },
  { header: 'Price', value: (r) => r.price },
  { header: 'Notes', value: (r) => r.notes },
];

export const REVIEW_EXPORT_COLUMNS: {
  header: string;
  value: (entry: ReviewExportEntry) => string;
}[] = [
  { header: 'Event ID', value: (e) => e.eventId },
  { header: 'Event Name', value: (e) => e.eventName },
  { header: 'Event Date', value: (e) => e.eventDate },
  { header: 'Event Address', value: (e) => e.eventAddress },
  { header: 'Event Status', value: (e) => e.eventStatus },
  { header: 'Brewery', value: (e) => e.brewery },
  { header: 'Brewery Location', value: (e) => e.breweryLocation },
  { header: 'Drink ID', value: (e) => e.drinkId },
  { header: 'Beer Name', value: (e) => e.drinkName },
  { header: 'Style', value: (e) => e.style },
  { header: 'Type', value: (e) => e.type },
  { header: 'ABV', value: (e) => e.abv },
  { header: 'Serving Format', value: (e) => e.caskOrKeg },
  {
    header: 'Vegan',
    value: (e) => (e.isVegan === true ? 'true' : e.isVegan === false ? 'false' : ''),
  },
  {
    header: 'Gluten Free',
    value: (e) => (e.isGlutenFree === true ? 'true' : e.isGlutenFree === false ? 'false' : ''),
  },
  { header: 'Description', value: (e) => e.description },
  { header: 'Review ID', value: (e) => e.reviewId },
  { header: 'Rating', value: (e) => String(e.rating) },
  { header: 'Notes', value: (e) => e.comment },
  { header: 'Tasting Tags', value: (e) => e.tastingTags.join('; ') },
  { header: 'Serving Size', value: (e) => e.servingSize },
  { header: 'Price', value: (e) => e.price },
  { header: 'Review Date', value: (e) => e.createdAt },
  { header: 'Photo URL', value: (e) => e.imageUrl || '' },
];

/**
 * Quotes a CSV field. Text starting with `=`, `+`, `-` or `@` (or a tab/CR) would be run as a
 * formula by spreadsheet apps, and review notes are free text, so those get a leading `'`.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds the legacy diary CSV with a UTF-8 BOM. */
export function buildDiaryCsv(rows: DiaryRow[]): string {
  const lines = [
    DIARY_COLUMNS.map((c) => csvField(c.header)).join(','),
    ...rows.map((row) => DIARY_COLUMNS.map((c) => csvField(c.value(row))).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Builds RFC 4180 compliant CSV string for complete review export entries,
 * prefixed with a UTF-8 BOM (\uFEFF) for compatibility with Excel and spreadsheet tools.
 */
export function buildReviewCsv(entries: ReviewExportEntry[]): string {
  const lines = [
    REVIEW_EXPORT_COLUMNS.map((c) => csvField(c.header)).join(','),
    ...entries.map((entry) => REVIEW_EXPORT_COLUMNS.map((c) => csvField(c.value(entry))).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Builds formatted 2-space indented JSON string for complete review export entries.
 */
export function buildReviewJson(entries: ReviewExportEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

/**
 * Formats a Date object as YYYY-MM-DD.
 */
export function formatExportDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates clean export filename following `keg-swap-reviews-YYYY-MM-DD.{format}`.
 */
export function generateExportFilename(format: 'csv' | 'json', d: Date = new Date()): string {
  const stamp = formatExportDate(d);
  return `keg-swap-reviews-${stamp}.${format}`;
}

/** Triggers a browser download of `text` as a file. */
export function downloadTextFile(filename: string, mimeType: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
