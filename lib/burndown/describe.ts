import { formatDate, formatDaySpan } from "@/lib/dates";

import { reconstructedRuns, type BurnReading } from "./reading";

/**
 * The sentences that go around the burn-down chart.
 *
 * A picture of a falling line says how fast the money went and nothing at all
 * about what the line is made of, where it starts, or how much of it was
 * reconstructed after the fact. Those are the things a reader has to know
 * before they quote a figure off it, and a chart that leaves them to be
 * inferred is a chart that will be misread.
 *
 * Separate from `lib/projects/burn-summary.ts`, which is the vocabulary of the
 * figures panel above it, because these answer a different question. That file
 * says what a number means; this says what a *line* can and cannot be taken
 * for.
 */

/**
 * What the line is, in one sentence under the chart.
 *
 * It names the subtraction, because "burn-down" is a term of art and the
 * figure on the axis is not one anybody has been shown before — the panel
 * above gives what is left as a number, and this says that the line is that
 * number, every day.
 *
 * It also says where the line starts, which is the thing most likely to be
 * misread. A burn-down normally starts at the price on the day the engagement
 * began; this one starts on the first day somebody logged time against it,
 * because that is the first day there is anything to know. A project agreed in
 * January and started in March has a line that begins in March, and without
 * the sentence that reads as two lost months.
 */
export const BURN_DOWN_IS_WHAT_WAS_LEFT =
  "The line is the contract value less what the logged hours had come to at " +
  "the end of each day. It starts on the first day time was logged against " +
  "the project, not the day the project was agreed.";

/**
 * How much history the chart is drawn from: how many days have a reading, and
 * which days they run between.
 *
 * Under the chart rather than on it, because it is the sort of thing a reader
 * checks once and then stops seeing. The count matters more than it looks: a
 * line drawn through four readings and a line drawn through two hundred look
 * much the same at this size, and only one of them is worth reading a slope
 * off.
 *
 * Null for a project with no readings, which has no chart either.
 */
export function describeBurnDownSpan(
  readings: readonly BurnReading[],
): string | null {
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (first === undefined || last === undefined) return null;

  if (readings.length === 1) {
    return `One reading, on ${formatDate(first.onDate)}.`;
  }
  return `${readings.length} readings, ${formatDaySpan(first.onDate, last.onDate)}.`;
}

/**
 * Why a reconstructed stretch is worth less than a measured one.
 *
 * The honest half of the caveat, and the half that is easy to get wrong in
 * the direction of alarm: nothing about the hours is in doubt. The time
 * entries carry the day they were worked on, so a reconstruction knows
 * exactly how many minutes went in on each past day. What it cannot know is
 * what the project was sold for in March, or what an hour billed at then,
 * because no column has ever recorded either — so it values the past at the
 * figures of the present and says so.
 */
export const RECONSTRUCTED_AT_TODAY_S_FIGURES =
  "The hours are the hours that were logged, but they are valued at the rate " +
  "and the contract value the project carries now — nothing recorded what " +
  "either of those was at the time.";

/**
 * The caveat for the stretches of the line that were reconstructed, or null
 * when every reading was taken on its own day.
 *
 * Three sentences rather than one assembled from fragments, because the
 * difference between them is not a word: a chart that is entirely a
 * reconstruction is a different thing to look at than one with a repaired
 * gap in the middle, and a reader deciding whether to quote a figure needs to
 * know which they have.
 *
 * The stretch is named by its days as well as shaded, so the caveat still
 * says something to a reader who cannot see the shading — on a printout, in
 * forced colours, or with the chart read out to them.
 */
export function describeReconstruction(
  readings: readonly BurnReading[],
): string | null {
  const runs = reconstructedRuns(readings);
  const [only] = runs;
  if (only === undefined) return null;

  if (readings.every((reading) => reading.origin === "backfilled")) {
    return `Every reading on this chart was reconstructed after the fact. ${RECONSTRUCTED_AT_TODAY_S_FIGURES}`;
  }
  if (runs.length === 1) {
    return `The shaded stretch, ${formatDaySpan(only.from, only.to)}, was reconstructed after the fact. ${RECONSTRUCTED_AT_TODAY_S_FIGURES}`;
  }
  return `The ${runs.length} shaded stretches were reconstructed after the fact. ${RECONSTRUCTED_AT_TODAY_S_FIGURES}`;
}
