/**
 * Parses a calendar date string as a local date.
 *
 * `new Date('2026-07-12')` is interpreted as UTC midnight, which renders as the
 * previous day in timezones west of UTC. Event dates are calendar days, so
 * `YYYY-MM-DD` values are built in local time instead. Other formats fall back
 * to the native parser.
 */
export function parseLocalDate(dateString: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return new Date(dateString);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
