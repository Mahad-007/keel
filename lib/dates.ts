/**
 * Dates are ISO strings in the database — either a full timestamp written by
 * the data layer (`2026-09-21T09:36:00.000Z`) or SQLite's own
 * `current_timestamp` form (`2026-09-21 09:36:00`).
 *
 * Formatting reads the calendar date off the front of the string instead of
 * constructing a `Date`. A row written at 23:00 UTC would otherwise display as
 * the previous day for anyone behind UTC, and the server and the browser would
 * disagree about which day that was.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LEADING_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/;

/**
 * `2026-09-21T09:36:00.000Z` becomes `Sep 21, 2026`. Anything that isn't a
 * date is handed back untouched: a surprising value in one cell is better than
 * a page that won't render.
 */
export function formatDate(value: string): string {
  const match = LEADING_DATE.exec(value.trim());
  if (!match) return value;

  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (name === undefined) return value;

  return `${name} ${Number(day)}, ${year}`;
}
