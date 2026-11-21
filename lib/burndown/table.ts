import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";
import { formatCents } from "@/lib/money";

import type { BurnReading } from "./reading";

/**
 * The burn-down as a table, for every reader and every case the picture does
 * not serve.
 *
 * A chart is a shape, and a shape cannot be read out, copied into an email,
 * searched for a date, or checked against an invoice. The table is not a
 * fallback for the chart — it is the same readings at full precision, and on
 * a page whose house style already prefers a table to a chart it is arguably
 * the primary of the two. It sits under the picture, folded away, because
 * most visits want the slope and some want the figures.
 *
 * The words and the formatting are here rather than in the component for the
 * reason the rest of this directory is: a cell that rounds differently from
 * the panel above it is a bug, and a bug in a `.tsx` file is a bug nothing
 * tests.
 */

/** What each column of the readings table is called. */
export const BURN_DOWN_COLUMNS = {
  day: "Day",
  logged: "Logged",
  burned: "Burned",
  left: "Left",
  reading: "Reading",
} as const;

/**
 * What a measured reading and a reconstructed one are called in the table.
 *
 * One word each, because this is a column somebody skims down looking for the
 * point where the history stops being a reconstruction. The caveat above the
 * chart explains what the distinction means; the cell only has to mark it.
 */
export const READING_ORIGIN_LABELS = {
  recorded: "Measured",
  backfilled: "Reconstructed",
} as const;

/** One row of the readings table, every cell already written out. */
export type BurnDownRow = {
  /** The day, as stored, which is what makes the row unique. */
  readonly onDate: string;
  readonly day: string;
  readonly logged: string;
  readonly burned: string;
  readonly left: string;
  readonly reading: string;
};

/**
 * A reading as a row of the table.
 *
 * Every figure is a running total up to the end of that day rather than the
 * day's own work, which is what the chart plots and what the stored reading
 * holds. A table of daily increments would be a different and also useful
 * table, and it would disagree with the line directly above it.
 *
 * The amounts go through `formatCents` and the time through `formatMinutes`,
 * the same two functions the figures panel uses, so a reader checking the
 * last row against the panel above finds the same string.
 */
export function burnDownRow(reading: BurnReading): BurnDownRow {
  return {
    onDate: reading.onDate,
    day: formatDate(reading.onDate),
    logged: formatMinutes(reading.loggedMinutes),
    burned: formatCents(reading.burnedCents),
    left: formatCents(reading.remainingCents),
    reading: READING_ORIGIN_LABELS[reading.origin],
  };
}

/**
 * The whole table, newest reading first.
 *
 * The opposite order to the chart, deliberately. A line is read left to right
 * because that is where time goes, and a list is read from the top because
 * that is where attention goes — and the row somebody opens this for is the
 * most recent one. It is the same order the status history on this tab
 * already uses.
 */
export function burnDownRows(
  readings: readonly BurnReading[],
): BurnDownRow[] {
  return readings.map(burnDownRow).reverse();
}
