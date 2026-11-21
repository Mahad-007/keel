import { calendarDayGap, formatDate, formatDaySpan } from "@/lib/dates";
import { formatCents } from "@/lib/money";

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
export const RECONSTRUCTED_AT_PRESENT_FIGURES =
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
    return `Every reading on this chart was reconstructed after the fact. ${RECONSTRUCTED_AT_PRESENT_FIGURES}`;
  }
  if (runs.length === 1) {
    return `The shaded stretch, ${formatDaySpan(only.from, only.to)}, was reconstructed after the fact. ${RECONSTRUCTED_AT_PRESENT_FIGURES}`;
  }
  return `The ${runs.length} shaded stretches were reconstructed after the fact. ${RECONSTRUCTED_AT_PRESENT_FIGURES}`;
}

/**
 * How far behind the day the end of the line is allowed to be before the
 * chart says so: one day.
 *
 * A reading is taken for a day once that day is over, so the newest point on
 * a chart looked at this morning is yesterday's, and that is the chart
 * working rather than the chart being stale. Two days is the first gap that
 * means something — either nobody has worked on the project, or nothing has
 * been recorded about it, and the chart cannot tell those apart.
 */
const LINE_IS_CURRENT_WITHIN_DAYS = 1;

/**
 * The note for a line that stops short of today, or null for one that does
 * not.
 *
 * The end of a burn-down is the figure a reader takes away, and it is the one
 * figure on the chart that silently goes out of date: the line simply stops,
 * and a line that stops looks exactly like a project that has settled down.
 * Saying how old the last point is turns "this project is holding steady"
 * back into "nobody has recorded anything for three weeks", which is a
 * different conversation.
 *
 * It does not guess which of those it is. A gap at the end means no reading
 * was taken, and a reading is not taken for a day nobody logged time on — so
 * a quiet fortnight and a capture that stopped running leave the same mark.
 * Naming the date and the gap says what is known; anything beyond that would
 * be the chart inventing a reason.
 *
 * `today` is the caller's day rather than a clock read here, like everywhere
 * else in the codebase that compares against now — so a page renders one
 * reading of the date and the sentence cannot disagree with the heading above
 * it.
 */
export function describeStaleLine(
  readings: readonly BurnReading[],
  today: string,
): string | null {
  const last = readings[readings.length - 1];
  if (last === undefined) return null;

  const behind = calendarDayGap(last.onDate, today);
  if (behind <= LINE_IS_CURRENT_WITHIN_DAYS) return null;

  return `The line stops at ${formatDate(last.onDate)}, ${behind} days ago. Nothing has been recorded against this project since, so the chart says nothing about the days after it.`;
}

/**
 * The chart in a sentence, for a reader who is not looking at it.
 *
 * The text alternative the SVG carries, and the thing that decides whether
 * this chart is usable without eyes. A picture of a line has exactly one
 * claim to make — it started here, it ended there, and this is the direction
 * it went — and saying that in words costs a sentence.
 *
 * It names the direction rather than leaving it to be worked out from two
 * amounts, because "falling" is the word somebody would use and subtracting
 * one currency figure from another read out loud is not.
 *
 * A line that rose is not a mistake and is not hidden: a time entry deleted
 * or corrected downwards gives back money the chart had already spent, and
 * that is a real thing to have happened to an engagement.
 *
 * The overrun is spelled out as its own amount rather than left as a figure
 * with a minus sign in front of it. "-$1,200.00 left" is a sentence a reader
 * has to translate, and the translation is the whole point of the chart.
 */
export function describeBurnDownLine(
  readings: readonly BurnReading[],
): string | null {
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (first === undefined || last === undefined) return null;

  const over =
    last.remainingCents < 0
      ? ` That is ${formatCents(-last.remainingCents)} past the contract value.`
      : "";

  if (readings.length === 1) {
    return `One reading: ${formatCents(first.remainingCents)} of ${formatCents(first.contractedCents)} left at the end of ${formatDate(first.onDate)}.${over}`;
  }
  if (last.remainingCents === first.remainingCents) {
    return `Flat at ${formatCents(first.remainingCents)} left, from ${formatDate(first.onDate)} to ${formatDate(last.onDate)}.${over}`;
  }

  const direction = last.remainingCents < first.remainingCents ? "Falling" : "Rising";
  return `${direction} from ${formatCents(first.remainingCents)} left on ${formatDate(first.onDate)} to ${formatCents(last.remainingCents)} on ${formatDate(last.onDate)}.${over}`;
}

/**
 * The label beside the dot on the end of the line.
 *
 * The one direct label on the chart, and the only number printed on it. A
 * figure beside every reading would be unreadable, and the axis plus the
 * table below carry the rest — but the end of the line is where every reader
 * looks first and the figure they will quote, so it is worth the ink.
 *
 * It says "left" or "over" rather than printing a signed amount. A minus sign
 * on a currency figure is the kind of thing a reader's eye slides past, and
 * the two states it distinguishes are the two the whole page exists to tell
 * apart.
 */
export function describeLineEnd(reading: BurnReading): string {
  return reading.remainingCents < 0
    ? `${formatCents(-reading.remainingCents)} over`
    : `${formatCents(reading.remainingCents)} left`;
}

/**
 * Everything a reader has to be told before they read this line, in the
 * order the line is read.
 *
 * Reconstruction first, because it is about the left-hand end and the body
 * of the chart; staleness second, because it is about the right-hand end.
 * Somebody working across the picture meets each caveat where it applies.
 *
 * An array rather than one paragraph, the arrangement `burnProblems` keeps:
 * two things worth knowing are two things, and running them together would
 * make a single hedge out of two specific statements. Usually it is empty,
 * and an empty list is a chart that can be read as it stands.
 *
 * It deliberately does not repeat what the figures panel above already says.
 * A project with no rate has a flat line and a panel that explains exactly
 * why in the sentence above the chart; saying it twice on one tab is how a
 * reader learns to skim the caveats.
 */
export function burnDownCaveats(
  readings: readonly BurnReading[],
  today: string,
): string[] {
  return [
    describeReconstruction(readings),
    describeStaleLine(readings, today),
  ].filter((caveat): caveat is string => caveat !== null);
}
