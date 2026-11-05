import { isCalendarDate } from "@/lib/dates";

/**
 * The stretch of days a time log is showing, with either end able to be open.
 *
 * Open ends are not a missing filter, they are the two filters a reader
 * actually asks for: "everything since the first of the month" and "everything
 * up to the day the invoice was raised". Forcing both ends would mean inventing
 * a bound — today, or the first entry ever logged — and a bound nobody typed is
 * a bound that silently drops the work either side of it.
 *
 * Calendar dates rather than timestamps, because `worked_on` holds a day. Both
 * ends inclusive, for the reason `WorkedOnRange` gives: a week is seven days,
 * and a range that excluded its last one would lose every Sunday to an
 * off-by-one nobody would see until a month came up short.
 *
 * Pure, and all of it over strings. `YYYY-MM-DD` sorts the way the calendar
 * does, so nothing here constructs a `Date` to compare two days.
 */
export type DateRange = {
  /** The first day to include, or null for no lower bound. */
  readonly from: string | null;
  /** The last day to include, or null for no upper bound. */
  readonly to: string | null;
};

/** Both ends open: every day there is. What a log with no date params shows. */
export const ALL_DATES: DateRange = { from: null, to: null };

/**
 * A `?from=` or `?to=` param narrowed to a day, or null when there is no day
 * in it.
 *
 * Anything that is not a calendar date opens that end rather than failing, the
 * same call every other param on this page makes. A half-typed date arriving
 * from a browser that submits one — or a bookmark from before a rename — is
 * still a request for the log, and the filter row shows the end as empty,
 * which is how a reader finds out the bound did not take.
 *
 * A timestamp is refused rather than truncated. `isCalendarDate` is what the
 * column itself is guarded by, and a bound of `2026-10-16T09:00` compared as a
 * string against days would quietly exclude the whole of its own date.
 */
export function parseRangeEnd(value: string | undefined): string | null {
  if (value === undefined) return null;
  return isCalendarDate(value) ? value : null;
}

/** A range built from the two params, either or both of which may be absent. */
export function rangeFromParams(
  from: string | undefined,
  to: string | undefined,
): DateRange {
  return { from: parseRangeEnd(from), to: parseRangeEnd(to) };
}
