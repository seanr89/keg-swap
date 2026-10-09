export type AbvBracket = 'low' | 'mid' | 'strong' | 'imperial';

interface AbvBracketDefinition {
  id: AbvBracket;
  label: string;
  matches: (abv: number) => boolean;
}

/**
 * ABV brackets for the event drink filter. Together they cover every non-negative value
 * exactly once (4.0% is Mid, 6.0% is Strong, 8.5% is Strong, 8.51% is Imperial).
 */
export const ABV_BRACKETS: readonly AbvBracketDefinition[] = [
  { id: 'low', label: 'Low / Session (< 4.0%)', matches: (abv) => abv < 4 },
  { id: 'mid', label: 'Mid-range (4.0% – 5.9%)', matches: (abv) => abv >= 4 && abv < 6 },
  { id: 'strong', label: 'Strong (6.0% – 8.5%)', matches: (abv) => abv >= 6 && abv <= 8.5 },
  { id: 'imperial', label: 'Imperial / High Gravity (> 8.5%)', matches: (abv) => abv > 8.5 },
];

/** Parses an ABV string such as `"4.6%"`; returns `null` when it is not a usable number. */
export function parseAbv(abv: string): number | null {
  const value = Number.parseFloat(abv.replace('%', '').trim());
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Returns the bracket an ABV string falls into, or `null` when the ABV cannot be parsed. */
export function getAbvBracket(abv: string): AbvBracket | null {
  const value = parseAbv(abv);
  if (value === null) return null;
  return ABV_BRACKETS.find((bracket) => bracket.matches(value))?.id ?? null;
}
