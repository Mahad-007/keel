import {
  calendarDateParts,
  isCalendarDate,
  shiftCalendarDate,
} from "@/lib/dates";

/**
 * The seven days a timesheet is read in, as arithmetic on calendar dates.
 *
 * A week is the unit time is reported in — what went on this week, what is
 * left to log before Friday — and it is the one unit the `worked_on` column
 * cannot answer on its own. Everything here turns a `YYYY-MM-DD` into the week
 * it falls in, and a week into the days it holds, so the page can ask for a
 * range and label the columns without constructing a `Date` anywhere a reader
 * can see.
 *
 * Pure, and all of it over strings. A calendar date is a day and not a moment
 * — `lib/dates.ts` says why — so the walking from one day to the next goes
 * through `shiftCalendarDate`, which keeps the `Date` it needs in UTC and
 * hands a string back out. A week that depended on the server's timezone would
 * be a different seven days for the person reading it than for the query that
 * filled it in.
 */

/** Seven. Named because a grid's column count and a shift both mean this one. */
export const DAYS_PER_WEEK = 7;

/**
 * The names of the days, in JavaScript's own order so `getUTCDay()` indexes
 * them directly. Three letters, because they are column headings over a grid
 * seven wide and the date is in the heading beside them.
 */
export const WEEKDAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/**
 * The day a week starts on, in the same numbering as `WEEKDAY_NAMES`: Monday.
 *
 * Monday rather than Sunday because the work week is the thing being reported
 * — a timesheet split across two columns at opposite ends of the grid is a
 * weekend nobody can total — and because that is what the rest of the world
 * outside North America means by a week.
 *
 * One constant rather than a parameter, for now. Day 098 adds a setting for
 * it, and the thing that makes that change small is that every function here
 * reads the start from one place instead of each deciding for itself.
 */
export const WEEK_STARTS_ON = 1;

/**
 * Which day of the week a date is, in `WEEKDAY_NAMES`' numbering.
 *
 * UTC, for the reason `shiftCalendarDate` gives: a bare date read in a local
 * timezone is the day before for anyone west of Greenwich, and a grid whose
 * columns were a day out from its headings would be wrong in a way nothing on
 * screen could explain.
 */
function dayOfWeek(value: string): number {
  if (!isCalendarDate(value)) {
    throw new Error(`not a calendar date: ${value}`);
  }
  return new Date(`${value}T00:00:00.000Z`).getUTCDay();
}

/**
 * How far into its week a date sits: 0 on the start day, 6 on the day before
 * the next one.
 *
 * Relative to `WEEK_STARTS_ON` rather than to Sunday, because this is the
 * column a date belongs in. Everything that lines a date up with a heading or
 * walks back to the start of a week counts in these, so moving the week start
 * moves the grid and the arithmetic together.
 */
export function weekdayIndex(value: string): number {
  return (dayOfWeek(value) - WEEK_STARTS_ON + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** What a day of the week is called: `2026-10-26` is `Mon`. */
export function weekdayName(value: string): string {
  return WEEKDAY_NAMES[dayOfWeek(value)];
}

/**
 * Seven days with their ends named.
 *
 * `start` and `end` are both held even though either could be derived from the
 * other, because both are read constantly: `start` is what the URL carries and
 * what identifies the week, `end` is the other side of every range query, and
 * a caller recomputing one from the other is a caller that can get it wrong by
 * a day.
 *
 * `days` is the seven dates in order, which is the grid's columns. It is built
 * once and passed down rather than derived per row — a sheet with forty
 * projects in it would otherwise do the same seven-day walk forty times, and
 * the columns have to be the same seven in every row or the cells do not line
 * up with their headings.
 */
export type Week = {
  /** The first day of the week: `YYYY-MM-DD`. */
  readonly start: string;
  /** The last day, six days after the first. */
  readonly end: string;
  /** All seven days, earliest first. */
  readonly days: readonly string[];
};

/**
 * The first day of the week a date falls in: any day of that week in, the
 * start day out.
 *
 * This is what identifies a week everywhere else — the URL carries it, the
 * range query starts at it, and two dates in the same week reduce to the same
 * string. Idempotent, so calling it on a start day is a no-op rather than a
 * jump back seven days, which is what lets a param holding either a Monday or
 * the Thursday somebody was looking at resolve to the same sheet.
 */
export function startOfWeek(value: string): string {
  return shiftCalendarDate(value, -weekdayIndex(value));
}

/**
 * The week a date falls in, with its ends and its seven days.
 *
 * Any day of the week in, so a URL holding the Thursday somebody was looking
 * at and one holding that week's Monday build the same sheet. The days are
 * walked out from the start rather than derived from the input, which is what
 * makes `days[0]` always the start and `days[6]` always the end however the
 * week was asked for.
 */
export function weekOf(value: string): Week {
  const start = startOfWeek(value);
  const days = Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
    shiftCalendarDate(start, offset),
  );
  return { start, end: days[DAYS_PER_WEEK - 1], days };
}

/**
 * The week a given number of weeks away: `shiftWeek(week, -1)` is the one
 * before it.
 *
 * Built by shifting the start and rebuilding, rather than by shifting all
 * seven days, because a week is identified by its start and the rest follows.
 * It also means the result is a week that `weekOf` could have produced, which
 * is what the back and forward links rely on — stepping back four times and
 * forward four times lands on the week it left.
 */
export function shiftWeek(week: Week, weeks: number): Week {
  return weekOf(shiftCalendarDate(week.start, weeks * DAYS_PER_WEEK));
}

/** The week before this one, which is what the back link points at. */
export function previousWeek(week: Week): Week {
  return shiftWeek(week, -1);
}

/** The week after this one. */
export function nextWeek(week: Week): Week {
  return shiftWeek(week, 1);
}

/**
 * Whether a day falls inside a week, ends included.
 *
 * Compared as strings, which `YYYY-MM-DD` makes safe: the format sorts the
 * same way the calendar does, so two dates compare without either being
 * parsed. It also means a value that is not a calendar date simply falls
 * outside every week rather than throwing — this is a filter over rows the
 * query already restricted, and a single odd `worked_on` should leave one cell
 * empty rather than take the page down.
 */
export function isInWeek(week: Week, value: string): boolean {
  return value >= week.start && value <= week.end;
}

/** The days of the week that are not normally worked, in `WEEKDAY_NAMES`' numbering. */
const WEEKEND_DAYS = [0, 6];

/**
 * Whether a day is a Saturday or a Sunday.
 *
 * The grid uses it to set the weekend columns back a shade. Not to hide them:
 * work does happen at the weekend, and a timesheet that could not show it
 * would be a timesheet somebody keeps a second copy of. The point is that five
 * of the seven columns are where the eye should land first, and a column that
 * is usually empty should look like one.
 *
 * Saturday and Sunday regardless of where the week starts, because this is a
 * claim about the day rather than about its position in the grid.
 */
export function isWeekend(value: string): boolean {
  return WEEKEND_DAYS.includes(dayOfWeek(value));
}

/**
 * A week as a heading: `Oct 26 – Nov 1, 2026`.
 *
 * Three shapes, because repeating what has not changed is what makes a date
 * range hard to read. A week inside one month says the month once — `Oct 5 –
 * 11, 2026` — and a week inside one year says the year once. Only a week that
 * straddles New Year spells both out: `Dec 28, 2026 – Jan 3, 2027`, where
 * dropping the first year would be wrong rather than merely repetitive.
 *
 * An en dash with spaces around it, not a hyphen. `Oct 26 - Nov 1` reads as
 * subtraction at a glance, and the heading sits above a grid full of numbers.
 *
 * A week whose ends are not calendar dates — which `weekOf` cannot produce,
 * but a hand-built literal can — falls back to the two strings. The heading
 * then looks wrong, which is the point: a page that renders a surprising
 * heading is easier to diagnose than one that will not render.
 */
export function describeWeek(week: Week): string {
  const from = calendarDateParts(week.start);
  const to = calendarDateParts(week.end);
  if (from === null || to === null) return `${week.start} – ${week.end}`;

  if (from.year !== to.year) {
    return `${from.month} ${from.day}, ${from.year} – ${to.month} ${to.day}, ${to.year}`;
  }
  if (from.month === to.month) {
    return `${from.month} ${from.day} – ${to.day}, ${to.year}`;
  }
  return `${from.month} ${from.day} – ${to.month} ${to.day}, ${to.year}`;
}
