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

/**
 * Quotes a CSV field. Text starting with `=`, `+`, `-` or `@` (or a tab/CR) would be run as a
 * formula by spreadsheet apps, and review notes are free text, so those get a leading `'`.
 */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds the diary CSV, with a UTF-8 BOM so Excel reads non-ASCII names correctly. */
export function buildDiaryCsv(rows: DiaryRow[]): string {
  const lines = [
    DIARY_COLUMNS.map((c) => csvField(c.header)).join(','),
    ...rows.map((row) => DIARY_COLUMNS.map((c) => csvField(c.value(row))).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
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
