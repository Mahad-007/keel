import { reconstructedSince, type BurnReading } from "@/lib/burndown/reading";
import { calendarDayGap } from "@/lib/dates";
import type {
  ProjectionCaveat,
  ProjectionConfidence,
  ProjectionEvidence,
} from "@/lib/projection/confidence";
import type { BurnForecast } from "@/lib/projection/forecast";
import {
  classifyPaceShift,
  paceChangeRatio,
  windowCoversWholeHistory,
  type BurnRate,
  type PaceShift,
} from "@/lib/projection/rate";
import { unestimatedUndeliveredCount, type ScopeLine } from "@/lib/scope";

/**
 * Where a project's projection comes from.
 *
 * `lib/projection/` is three modules of arithmetic that know nothing about
 * each other's inputs: the rate reads a list of readings, the forecast reads
 * six numbers, and the confidence reads eight counts. That is right for all
 * three — each is testable on its own and none of them can form a second
 * opinion about the others — and it leaves exactly one job undone, which is
 * reading four sources in the right order and putting the answers in the right
 * arguments.
 *
 * This is that assembly, written once, for the same reason
 * `projectCreepReadings` exists. The expensive mistakes here are all silent in
 * the unit tests either side of them. Forecast from the last stored reading
 * rather than the live burn and today's work disappears. Count the delivered
 * unsized lines rather than the open ones and the caveat fires on the projects
 * it does not apply to and stays quiet on the ones it does. Hand the forecast
 * the overall pace while handing the words the recent one and the page
 * explains a date that was worked out from a different number.
 *
 * One module that does it, called by the page and by the integration test
 * alike, is what stops any of those happening twice.
 */

/**
 * A project's projection: the pace it was built on, where it lands, and how
 * much of that to believe.
 *
 * All four together rather than the forecast alone, because a forecast on its
 * own is the thing this milestone exists not to publish. The caveats and the
 * grade are not commentary bolted on afterwards; they are part of the value,
 * and a shape that let a caller take the dates without them would let a panel
 * print a Thursday with nothing underneath it.
 *
 * Both paces are carried, not just the one the forecast used. `pace` is what
 * the dates came from and the other two are what makes that choice checkable:
 * a reader who wants to know why the date moved can see that the fortnight ran
 * at twice the average, and `paceShift` is the same comparison already
 * classified so the words do not have to divide anything.
 */
export type ProjectProjection = {
  /** The pace the forecast was carried forward at. */
  readonly pace: BurnRate;
  /** The pace across the project's whole recorded history. */
  readonly overallPace: BurnRate;
  /** The pace over the recent window, or null when there was none to measure. */
  readonly recentPace: BurnRate | null;
  /** How the recent pace stands against the average, or null with no comparison. */
  readonly paceShift: PaceShift | null;
  /** Where the project lands if it carries on this way. */
  readonly forecast: BurnForecast;
  /** Everything wrong with the basis of that forecast, in reading order. */
  readonly caveats: readonly ProjectionCaveat[];
  /** How much of it to believe, folded from the caveats. */
  readonly confidence: ProjectionConfidence;
};

/**
 * The eight counts the caveats are read off, gathered from the readings, the
 * scope list and the clock.
 *
 * The two history counts come from the pace that was actually used rather than
 * from the readings as a whole, which is the point of passing it in. A project
 * six months old whose forecast was carried forward from a fortnight has a
 * fortnight of evidence behind its date, and reporting six months would be
 * vouching for days the arithmetic never touched. The reconstruction count is
 * bounded the same way, by the span the pace was measured over.
 *
 * `daysSinceLastReading` is measured from the last reading rather than from the
 * pace's own end date, and the two are the same day — both paces run to the
 * last reading, by construction. Reading it off the list is what makes that an
 * assertion about the data rather than an assumption about the pace.
 *
 * A project with no readings cannot reach here: the pace would not exist, and
 * `projectProjection` refuses before this is called.
 */
export function projectionEvidence(
  pace: BurnRate,
  overallPace: BurnRate,
  recentPace: BurnRate | null,
  readings: readonly BurnReading[],
  lines: readonly ScopeLine[],
  today: string,
): ProjectionEvidence {
  const last = readings[readings.length - 1];

  return {
    paceDays: pace.elapsedDays,
    readingCount: pace.readingCount,
    reconstructedCount: reconstructedSince(readings, pace.fromDate),
    daysSinceLastReading:
      last === undefined ? 0 : calendarDayGap(last.onDate, today),
    paceShift: classifyPaceShift(paceChangeRatio(overallPace, recentPace)),
    wholeHistoryWindow: windowCoversWholeHistory(overallPace, recentPace),
    lineCount: lines.length,
    unsizedUndeliveredCount: unestimatedUndeliveredCount(lines),
  };
}
