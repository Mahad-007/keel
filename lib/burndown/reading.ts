import { isCalendarDate } from "@/lib/dates";

import {
  isBurnSnapshotOrigin,
  type BurnSnapshotOrigin,
} from "./origin";
import { recordedBurnPoint, type BurnPoint, type RecordedBurn } from "./series";

/**
 * A stored burn reading as a chart reads it: the point, and how much of a
 * measurement it is.
 *
 * Day 035 stores the figures; this is the other direction, and the one thing
 * it adds to `recordedBurnPoint` is the origin. A chart draws a line through
 * every reading it is given, and a line says nothing about where its points
 * came from — so the stretch of history that was reconstructed after the fact
 * has to travel with the point or it cannot be marked, and a reader would take
 * a reconstruction of March for a measurement of it.
 *
 * `capturedAt` is deliberately absent. It is a fact about the row rather than
 * about the day, and the one question it answers — how stale the end of the
 * line is — is better answered by the last reading's own date against today,
 * which is what a reader can see on the axis.
 */
export type BurnReading = BurnPoint & {
  /** Whether the reading was measured on its day or reconstructed later. */
  readonly origin: BurnSnapshotOrigin;
};

/**
 * What a reading needs of a stored row: the nine columns a point is built
 * from, and the word that says how it was arrived at.
 *
 * A structural subset of the `burn_snapshots` row, extending the subset
 * `recordedBurnPoint` already takes, so a whole row satisfies it and so does a
 * literal in a test. The id, the project and the capture time are left out
 * because nothing a chart draws depends on them.
 *
 * `origin` is `string` rather than the union, which is the point of taking it
 * separately. The column is declared with an enum, but SQLite does not enforce
 * one: Drizzle types the value back as an origin whether or not the row holds
 * a word that is one.
 */
export type StoredBurnReading = RecordedBurn & {
  /** The origin column, as it comes back, which may be neither origin. */
  readonly origin: string;
};

/**
 * A stored row read as a reading of the burn-down.
 *
 * The figures go through `recordedBurnPoint` unchanged — the money comes back
 * as it was reported on the day, at the price and rate of the day — and this
 * adds the one judgement the chart needs on top of it.
 *
 * An origin the table does not know is read as `backfilled`, the weaker claim.
 * That is the safe direction and the only one worth defending: the caveat a
 * reconstruction carries costs a reader a sentence, and treating an unreadable
 * row as a measurement costs them a figure they would have quoted. The rows
 * that can reach here with a third word are hand-written ones, and a row
 * somebody wrote by hand is exactly the row not to vouch for.
 */
export function burnDownReading(stored: StoredBurnReading): BurnReading {
  return {
    ...recordedBurnPoint(stored),
    origin: isBurnSnapshotOrigin(stored.origin) ? stored.origin : "backfilled",
  };
}

/**
 * A project's stored rows read as the readings of its burn-down, oldest
 * first.
 *
 * The list form, and the one a chart is handed. Two things happen here that
 * are not worth repeating in every caller.
 *
 * The rows are sorted by date. The index the data layer reads them through
 * already returns them in order, so this is almost always a sort of a sorted
 * list — cheap, and the alternative is a chart whose line doubles back on
 * itself because somebody changed an `order by` in another file.
 *
 * A row whose day is not a calendar date is dropped rather than plotted. The
 * axis is measured in days from the first reading, and a string that is not a
 * day has no distance from one — `calendarDayGap` throws on it rather than
 * guessing, which is right there and would be a blank page here. Only a
 * hand-edited row can be in that state, and losing it from the line is a
 * smaller harm than losing the line.
 */
export function burnDownReadings(
  stored: readonly StoredBurnReading[],
): BurnReading[] {
  return stored
    .filter((row) => isCalendarDate(row.onDate))
    .map(burnDownReading)
    .sort((a, b) => a.onDate.localeCompare(b.onDate));
}

/** A stretch of the burn-down between two days, both ends included. */
export type ReadingRun = {
  /** The first day of the stretch: `YYYY-MM-DD`. */
  readonly from: string;
  /** The last day of it, which is the same day for a stretch of one. */
  readonly to: string;
};

/**
 * The stretches of a burn-down that were reconstructed rather than measured,
 * oldest first.
 *
 * Runs rather than a flag per reading, because what a reader needs marking is
 * a region of the chart and not a property of a point: "everything before
 * April is a reconstruction" is one thing to say and one band to draw, where
 * forty caveated points would be forty.
 *
 * Consecutive in the list, which is consecutive in time — the readings are
 * sorted — but not necessarily contiguous on the calendar. Two reconstructed
 * days a month apart with nothing between them are one run, because nothing
 * is what lies between them: the line across that gap is drawn from the
 * figures of the first, and the figures of the first are the reconstruction.
 *
 * Usually there is one run and it is at the start, because that is the shape
 * the backfill leaves. More than one happens when a repair fills a gap a
 * failed run left in the middle, and that is exactly the history a single
 * "the early part is reconstructed" would be wrong about.
 */
export function reconstructedRuns(
  readings: readonly BurnReading[],
): ReadingRun[] {
  const runs: ReadingRun[] = [];
  let open: { from: string; to: string } | null = null;

  for (const reading of readings) {
    if (reading.origin === "backfilled") {
      if (open === null) {
        open = { from: reading.onDate, to: reading.onDate };
        runs.push(open);
      } else {
        open.to = reading.onDate;
      }
    } else {
      open = null;
    }
  }
  return runs;
}
