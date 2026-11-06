/**
 * What the exported file is called.
 *
 * It matters more than it looks. An export lands in a downloads folder beside
 * last month's, and a reader who has pulled October's chargeable time and then
 * the whole quarter has two files to tell apart — from the name, because
 * neither of them is going to be opened twice. So the filters go in the name.
 *
 * The date range and the billing state, and not the project or the client.
 * Those two are ids in the URL and names in the heading, and a name built from
 * a client's own text is a different problem: it is unicode, it holds slashes
 * and quotes, and the filter can name a client with no entries at all, so
 * there is not always a name to use. `downloadFilename` would cut it to
 * hyphens anyway. Days and a word are what survive the trip intact.
 */

import {
  CHARGEABLE_TIME,
  FREE_TIME,
  type BillableFilter,
} from "./billable";
import type { TimeLogQuery } from "./log-query";
import type { DateRange } from "./range";

/** What every export is called before the filters are added to it. */
export const EXPORT_NAME_STEM = "keel-time";

/** What the file extension says it is. */
export const CSV_EXTENSION = ".csv";

/**
 * What a range with both ends open is called in a filename.
 *
 * Its own constant rather than the heading's `ALL_DATES_LABEL` lower-cased: a
 * filename and a heading are read by different things, and tying them together
 * would mean a reworded heading silently renaming every export.
 */
export const ALL_TIME_PART = "all-time";

/**
 * The days in the name: `2026-10-01-to-2026-10-31`, `from-2026-10-01`,
 * `to-2026-10-31`, `2026-10-16`, or `all-time`.
 *
 * Four shapes because an open end is a different claim rather than a missing
 * half of one, which is the distinction `describeRange` draws for the heading.
 * `from-2026-10-01` says the file holds everything since that day; a name that
 * left the word out would read as a single day's work.
 *
 * One day is that day once. `2026-10-16-to-2026-10-16` is a filename that
 * takes a second read to tell from a range.
 *
 * `all-time` rather than nothing, so an unfiltered export is `keel-time-all-
 * time.csv` and says what it is. A file called `keel-time.csv` sitting next to
 * `keel-time-2026-10-01-to-2026-10-31.csv` would leave a reader guessing which
 * of the two is everything.
 *
 * A range that runs backwards is named as it was typed. It holds no days and
 * exports as a header row, and a name that quietly turned the ends round would
 * disagree with both the URL and the file.
 */
export function rangeNamePart({ from, to }: DateRange): string {
  if (from === null) {
    return to === null ? ALL_TIME_PART : `to-${to}`;
  }
  if (to === null) return `from-${from}`;
  if (from === to) return from;
  return `${from}-to-${to}`;
}

/**
 * The billing state in the name, or null when both halves are in the file.
 *
 * Null rather than a word for the unfiltered case, for the reason
 * `timeLogHref` leaves the default param off: a name that said `everything`
 * would put a word in every filename to distinguish the commonest export from
 * nothing.
 *
 * `not-chargeable` rather than `free`, which is the URL's word for the same
 * filter. The param is short because it is typed; a filename is read, and
 * "free" beside a column of durations reads as time that cost nothing rather
 * than time nobody is being charged for.
 */
export function billingNamePart(filter: BillableFilter): string | null {
  if (filter === CHARGEABLE_TIME) return "chargeable";
  if (filter === FREE_TIME) return "not-chargeable";
  return null;
}

/**
 * The file's name: the stem, the days, the billing state if it narrows
 * anything, and `.csv`.
 *
 * Hyphens throughout and nothing else, so `downloadFilename` has nothing to
 * clean and the name in the downloads folder is the name built here.
 */
export function timeLogFilename(
  query: Pick<TimeLogQuery, "range" | "billable">,
): string {
  const parts = [EXPORT_NAME_STEM, rangeNamePart(query.range)];
  const billing = billingNamePart(query.billable);
  if (billing !== null) parts.push(billing);
  return `${parts.join("-")}${CSV_EXTENSION}`;
}
