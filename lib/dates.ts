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
 * The calendar date on the front of a stored value, split into the pieces a
 * label is built from — or null when there is no date there to read.
 *
 * `month` is the abbreviation rather than the number, because every caller
 * wants the word and none of them wants to index `MONTHS` for itself. An
 * impossible month is therefore the same answer as no date at all: a value
 * that cannot be named cannot be formatted, and both end with the caller
 * handing the string back untouched.
 *
 * `day` and `year` come back as numbers, so a caller can compare them without
 * parsing the strings again — which is what the week heading does to decide
 * whether to print the month twice.
 */
export function calendarDateParts(
  value: string,
): { year: number; month: string; day: number } | null {
  const match = LEADING_DATE.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (name === undefined) return null;

  return { year: Number(year), month: name, day: Number(day) };
}

/**
 * `2026-09-21T09:36:00.000Z` becomes `Sep 21, 2026`. Anything that isn't a
 * date is handed back untouched: a surprising value in one cell is better than
 * a page that won't render.
 */
export function formatDate(value: string): string {
  const parts = calendarDateParts(value);
  if (parts === null) return value;

  return `${parts.month} ${parts.day}, ${parts.year}`;
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

/**
 * The calendar date a moment falls on, read off the clock it is handed: `new
 * Date()` in a browser in Auckland becomes that browser's today, not UTC's.
 *
 * The only use for this is defaulting a field that asks which day somebody
 * worked on something, and that is why it reads local components rather than
 * calling `toISOString`. A `Date` is a moment, and the UTC day it falls on is
 * the wrong answer for most of the world for part of every day: at 09:00 in
 * Auckland it is still yesterday in UTC, so a server-rendered default would
 * file this morning's work under a day that is over.
 *
 * So this is called where the clock belongs to the person: the browser. The
 * value it produces is the `YYYY-MM-DD` the `workedOn` column wants, and
 * `isCalendarDate` accepts everything it returns — the padding is what
 * guarantees that for a single-digit month or day.
 */
export function localCalendarDate(moment: Date): string {
  const year = String(moment.getFullYear()).padStart(4, "0");
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The calendar date a given number of days away from another one:
 * `shiftCalendarDate("2026-10-31", 1)` is `2026-11-01`.
 *
 * Through `Date` at midnight UTC, because month lengths and leap years are not
 * worth reimplementing and `setUTCDate` already rolls over correctly. UTC
 * rather than local, which is the whole reason this takes and returns strings:
 * a `Date` built from a bare date in a local timezone is a different day for
 * half the world, and a week shifted that way could land on a Sunday for the
 * server and a Monday for the reader.
 *
 * The input has to be a calendar date and nothing else. A timestamp would make
 * the answer depend on a time of day this does not keep, and a caller handing
 * one over has confused a day with a moment — so it throws rather than quietly
 * rounding, the way `parseHours` throws on something that is not hours.
 *
 * Daylight saving does not come into it. The dates have no time of day, so
 * there is no hour to lose or repeat: the day after the clocks change is the
 * next date on the calendar, which is what somebody filling in a timesheet
 * means by tomorrow.
 */
export function shiftCalendarDate(value: string, days: number): string {
  if (!isCalendarDate(value)) {
    throw new Error(`not a calendar date: ${value}`);
  }
  if (!Number.isInteger(days)) {
    throw new Error(`not a whole number of days: ${days}`);
  }

  const moment = new Date(`${value}T00:00:00.000Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/**
 * The UTC calendar date a moment falls on.
 *
 * The counterpart of `localCalendarDate`, and the one a server component has
 * to use: there is no reader's clock on the server, so "today" can only mean
 * today somewhere, and UTC is the only choice that does not depend on where
 * the process happens to be deployed. A server in Sydney and a server in
 * Oregon then agree about which week a timesheet opens on, which is worth more
 * than either of them being right for one reader.
 *
 * It is wrong for part of every day for most of the world, and that is not
 * hidden: the week it picks is in the URL as soon as a reader moves, the
 * heading says which week is on screen, and nothing is written from it. Day
 * 098 is where the reader's own week and timezone become settings; until then
 * the honest default is the one that is the same everywhere.
 */
export function utcCalendarDate(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}
