import { formatDate, formatDaySpan, isCalendarDate } from "@/lib/dates";

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

/**
 * Whether a range leaves out any day at all.
 *
 * What decides whether the log is showing the whole book or a slice of it, and
 * therefore whether the heading has to say so. A page that announced its date
 * filter when there is none would be a label nobody reads on the day it
 * matters.
 */
export function isAllDates(range: DateRange): boolean {
  return range.from === null && range.to === null;
}

/**
 * Whether a range runs the wrong way: a first day after its last.
 *
 * Worth asking rather than quietly fixing. A backwards range holds no days, so
 * the query returns nothing — and an empty list under two date boxes that both
 * have dates in them reads as "there is no work here", which is the one wrong
 * conclusion. The page says the range runs backwards and offers to turn it
 * round, which is the fix the reader was going to make by hand.
 *
 * Swapping the ends here instead would be worse: a reader who typed the wrong
 * box would get a list that looks right, filtered to a range they did not ask
 * for, with the URL disagreeing with the boxes above it.
 *
 * An open end is never backwards — there is nothing for it to be after.
 *
 * The two ends come back rather than a bare yes, because the note that
 * explains this spells both of them out, and a caller handed `true` would
 * have to assert that the ends it already looked at are not null.
 */
export function backwardsEnds(
  range: DateRange,
): { readonly from: string; readonly to: string } | null {
  const { from, to } = range;
  if (from === null || to === null || from <= to) return null;
  return { from, to };
}

/**
 * The same question as a predicate, for the callers that only need the answer.
 *
 * Written in terms of `backwardsEnds` rather than beside it, so there is one
 * place the rule lives — two functions comparing the ends themselves would be
 * two chances to disagree about whether a single-day range counts.
 */
export function isBackwardsRange(range: DateRange): boolean {
  return backwardsEnds(range) !== null;
}

/**
 * The same range with its ends swapped, which is what the fix link points at.
 *
 * Unconditional, so it is a plain fact about the value rather than something
 * that only works on a range already known to be backwards. Applying it twice
 * is the range it started as.
 */
export function reverseRange(range: DateRange): DateRange {
  return { from: range.to, to: range.from };
}

/** What a log showing every day there is calls its range. */
export const ALL_DATES_LABEL = "All time";

/**
 * A range as a heading: `Oct 1 – 31, 2026`, `Since Oct 1, 2026`, `All time`.
 *
 * Four shapes, because an open end is a different sentence rather than a
 * missing half of one. `Oct 1 – ` with nothing after it would read as a
 * heading that failed to render, and `Oct 1 – Dec 31, 9999` would be a bound
 * nobody asked for presented as one they did.
 *
 * The closed shape is `formatDaySpan`'s, so the log's heading and the
 * timesheet's are the same heading. A backwards range is described as it was
 * typed rather than corrected, which is what makes the note beside it — the
 * range runs backwards, here it is turned round — say something the heading
 * does not already contradict.
 */
export function describeRange({ from, to }: DateRange): string {
  if (from === null) {
    return to === null ? ALL_DATES_LABEL : `Up to ${formatDate(to)}`;
  }
  if (to === null) return `Since ${formatDate(from)}`;
  return formatDaySpan(from, to);
}
