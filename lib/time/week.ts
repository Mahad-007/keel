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
 * The day a week starts on, as an index into `WEEKDAY_NAMES`: Monday.
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
export const WEEK_STARTS_ON = 0;

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
