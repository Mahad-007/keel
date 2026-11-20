import type { LoggedTotals } from "@/lib/time/rollup";

/**
 * A project's burn, day by day, as a series rather than as a total.
 *
 * Day 032 answered "what has this engagement consumed?" with one number, and
 * one number is what the overview needs. This is the same arithmetic asked
 * once per day: the minutes logged up to the end of each day, valued at the
 * rate, set against the price. The result is a line, and the shape of the line
 * is the thing a total cannot say — whether the budget went in the first
 * fortnight or evenly across six months.
 *
 * Everything here is pure, over plain numbers and calendar-date strings. No
 * row is read, no clock is consulted and nothing is formatted. The figures
 * come from `summariseBurn` rather than from arithmetic written again here, so
 * a point of the series and the panel above the chart cannot disagree about
 * what "burned" means — the storage of these points is
 * `lib/data/burn-snapshots.ts`, and the chart that plots them is Day 036's.
 */

/**
 * One day of a project's logged work: the day, and what was logged.
 *
 * `LoggedTotals` and a date, so the three figures are the same three the
 * rollups and the burn summary carry rather than a fourth spelling of them.
 * The totals are a day's *own* work when the day comes off a query, and the
 * running total up to and including it once `accumulateBurnDays` has been
 * through them — which is the only reason the type is not two types. A day in
 * a series and a day on its own hold the same three numbers, and saying so
 * twice would invite a function that accepted one and was handed the other.
 *
 * `onDate` rather than `workedOn`, which is the column these dates are read
 * from. The series is about days of an engagement and not about rows of a
 * timesheet: a point of the burn-down stands for the state of the project at
 * the end of that day, including days where the only thing that happened was
 * the clock going round, and "worked on" would be a claim about work that the
 * figures do not make.
 */
export type BurnDay = LoggedTotals & {
  /** The calendar date: `YYYY-MM-DD`, no time of day. */
  readonly onDate: string;
};
