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

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether a string is a calendar date and nothing else: `2026-10-16`, with no
 * time of day on the end of it.
 *
 * Some columns hold a day rather than a moment — the day a stretch of work was
 * done on, the day an invoice is due — and for those a timestamp is not a more
 * precise version of the same thing, it is a different value that reads as the
 * wrong day for anybody east or west of UTC. Refusing it at the column is the
 * only place the distinction can be kept, since both are strings once stored.
 *
 * The shape is checked and then the date is checked, because `2026-02-30`
 * passes any regex worth writing. The round trip through `Date` is what
 * catches it: a day that does not exist parses as either nothing at all or as
 * the day after the month ends, and neither comes back as the string it went
 * in as.
 */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().startsWith(value);
}
