import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type {
  ProjectionCaveat,
  ProjectionConfidence,
} from "@/lib/projection/confidence";
import type { BurnForecast } from "@/lib/projection/forecast";
import type { BurnRate } from "@/lib/projection/rate";

import type { ProjectProjection } from "./projection";

/**
 * The projection, in words a reader can act on.
 *
 * `lib/projection/` works out where a project lands and what is wrong with the
 * working. Every figure it produces is a number or a date, and not one of them
 * is a sentence — which is the gap this file closes, and the gap is wider here
 * than it was for any panel before it.
 *
 * A date is the most authoritative thing this app prints. "13 April 2026" does
 * not look like the output of two divisions over a fortnight of timesheet
 * rows, and it does not look conditional, and a reader who quotes it to a
 * client has staked something on arithmetic they could not see. So the words
 * do three jobs that the arithmetic cannot:
 *
 *   - They say the figures are an extrapolation, in the lead and not in a
 *     footnote. Every grade gets that sentence, including the best one.
 *   - They name each weakness with its own numbers in it, so a caveat is
 *     something to check or fix rather than a disclaimer to skim.
 *   - They say which pace the date came from, and what the other pace was. A
 *     reader who can see that the last fortnight ran at twice the average can
 *     decide for themselves how much the date is worth.
 *
 * Nothing is computed here beyond rounding for display. The figures are the
 * forecast's, the caveats are the confidence module's, and the one judgement
 * this file makes is which rows are worth drawing at all.
 */

/**
 * Whether the projected cost figures mean anything for this project.
 *
 * They need a scope list. With nothing in it the remaining work costs nothing,
 * so the projected final cost is the burn and the projected overage is
 * whatever has already been overspent — and a project with three months of
 * work ahead of it would read as expecting no overage at all. That is the one
 * place in this panel where a figure would be worse than a gap, because it is
 * wrong in the reassuring direction and looks like a measurement.
 *
 * The date the contract runs out survives, which is why the panel is still
 * drawn: it is worked out from the pace and the money, and neither of those
 * needs to know what the work is.
 *
 * Asked of the caveat rather than of the line count, so there is one place
 * that decides what an empty scope list means to a forecast and the sentence
 * explaining the gap cannot appear without the rows being withheld.
 */
export function hasProjectedCost(projection: ProjectProjection): boolean {
  return !projection.caveats.includes("no-scope");
}

/**
 * How much of the forecast to believe, in one word, for the corner of the
 * panel's heading.
 *
 * Deliberately not a colour and not a dot. The scope health banner has the
 * page's one coloured box and it earned it by reaching a verdict about the
 * project; this is a verdict about the *evidence*, which is a different kind
 * of thing and would be two amber boxes on one tab if it were drawn the same
 * way. A word in the heading is read on the way past, which is the only
 * attention this deserves — the caveats underneath are what matter.
 *
 * Capitalised as it is rendered, because it is a label rather than a sentence
 * fragment and nothing is prepended to it.
 */
export const CONFIDENCE_LABEL: Record<ProjectionConfidence, string> = {
  firm: "Firm basis",
  indicative: "Indicative",
  weak: "Weak basis",
};

/**
 * What the grade means, in a sentence, under the figures.
 *
 * One per grade, and all three say the same thing first: this is an
 * extrapolation. `firm` does not get a free pass — the inputs being in good
 * order says nothing about whether next month resembles last month, and a
 * panel that dropped the qualifier for its best projects would be at its most
 * confident exactly where it had least right to be.
 *
 * What differs is what to do about it. A firm basis can be quoted with the
 * qualifier attached. An indicative one is a shape rather than a figure — the
 * direction is right and the number will move. A weak one should not leave the
 * screen: the figures are shown because a frightening pace on a three-day-old
 * project is worth seeing, and they are not worth repeating to anybody.
 */
export const CONFIDENCE_LEAD: Record<ProjectionConfidence, string> = {
  firm:
    "This is an extrapolation, not a plan: it assumes the project carries on " +
    "at the pace it has been going and that the remaining estimates are " +
    "right. Every input it needs is present and was measured as it happened.",
  indicative:
    "This is an extrapolation, and the inputs behind it are approximate — " +
    "read the shape of it rather than the figures. What follows says which " +
    "parts are soft.",
  weak:
    "There is not enough measured history behind this to extrapolate from " +
    "with any confidence. It is shown because a pace worth worrying about is " +
    "worth seeing early, and it is not a figure to quote. What follows says " +
    "why.",
};

/**
 * A pace, as an amount of money a day.
 *
 * Per day because that is the unit the arithmetic is in: the readings are
 * stored a day apart, the division is by days, and every date on the panel is
 * a day count added to today. A figure per week would read more naturally and
 * would be a seventh of a lie — it would invite a reader to multiply it by the
 * weeks remaining and get an answer the panel disagrees with by whatever a
 * weekend is worth.
 *
 * Rounded to the cent only for display. The pace itself stays fractional
 * everywhere it is divided by, which is why this is the only place it is
 * rounded at all — a pace rounded before the forecast would compound over
 * ninety days.
 */
export function formatPace(centsPerDay: number): string {
  return `${formatCents(Math.round(centsPerDay))} a day`;
}

/**
 * How a pace was arrived at: over how long, and from how many readings.
 *
 * The sentence that makes a pace checkable rather than merely stated. Both
 * numbers are needed and neither implies the other — a fortnight holding two
 * readings and a fortnight holding fourteen divide to the same figure and
 * deserve different amounts of belief — and the end date is there because a
 * pace measured to a week ago is a different claim from one measured to today.
 *
 * It says nothing about whether any of that is *enough*. That is the caveats'
 * job, and a sentence that did both would be a caveat a reader met twice.
 */
export function describePaceBasis(pace: BurnRate): string {
  const days = pace.elapsedDays === 1 ? "one day" : `${pace.elapsedDays} days`;
  const readings =
    pace.readingCount === 1 ? "one reading" : `${pace.readingCount} readings`;
  return `Measured across ${days} to ${formatDate(pace.toDate)}, from ${readings}.`;
}

/**
 * What each caveat says, with the project's own numbers in it.
 *
 * A record of sentence-builders over the whole union, so a caveat added
 * without words is a compile error rather than an empty bullet. The same shape
 * `BLIND_SPOT_SENTENCE` takes, with one difference that earns its keep: these
 * are functions of the projection rather than fixed strings, because a caveat
 * without its figure is a disclaimer.
 *
 * "Some of the scope is unsized" is something a reader skims. "Two of the five
 * unfinished deliverables carry no estimate, so the figure above is a floor"
 * is something they can check against the scope tab and fix with a form. The
 * difference between those two sentences is most of what this milestone is
 * worth, so every one of these carries the count, the span or the pair of
 * paces it was decided on.
 *
 * Each ends by saying what it does to the figures, not merely what is wrong
 * with the data. A reader who has been told the history was reconstructed
 * still has to work out whether that makes the date early or late; a reader
 * told the rate it was valued at has somewhere to go.
 */
export const CAVEAT_SENTENCE: Record<
  ProjectionCaveat,
  (projection: ProjectProjection) => string
> = {
  "short-history": (projection) =>
    `The pace behind this is ${
      projection.evidence.paceDays === 1
        ? "a single day"
        : `${projection.evidence.paceDays} days`
    } of readings. A stretch that short says more about which days they were than about the engagement, and carrying it across a quarter multiplies whatever was unusual about them.`,

  "few-readings": (projection) =>
    projection.evidence.readingCount === 1
      ? "It rests on one reading, which is a point rather than a slope. The pace is that day's burn, assumed to be every day's."
      : `It rests on ${projection.evidence.readingCount} readings, which is a straight line drawn through ${projection.evidence.readingCount} points. Nothing in it could have disagreed with itself.`,

  "no-window": (projection) =>
    `The project has ${projection.evidence.paceDays} days of readings, so the recent fortnight this panel would normally check against the average is the whole history. There is one pace, and nothing corroborates it.`,

  "pace-changed": (projection) =>
    `The last stretch ran at ${formatPace(
      projection.pace.centsPerDay,
    )} against ${formatPace(
      projection.overallPace.centsPerDay,
    )} across the whole project. The dates come from the ${
      projection.evidence.paceShift === "faster" ? "faster" : "slower"
    } recent figure, so they would sit ${
      projection.evidence.paceShift === "faster" ? "later" : "sooner"
    } if the project returned to its average.`,

  "reconstructed-history": (projection) =>
    `${projection.evidence.reconstructedCount} of the ${projection.evidence.readingCount} readings behind this pace were reconstructed after the fact rather than measured on the day. Their hours are the hours that were logged, but valued at the rate and contract value the project carries now — so a rate that has moved since tilts the pace.`,

  "stale-readings": (projection) =>
    `No reading has been stored for this project for ${projection.evidence.daysSinceLastReading} days. The pace is a statement about a stretch that has already ended, and the dates are counted forward from today regardless.`,

  "unsized-scope": (projection) =>
    `${
      projection.evidence.unsizedUndeliveredCount === 1
        ? "One unfinished deliverable carries"
        : `${projection.evidence.unsizedUndeliveredCount} unfinished deliverables carry`
    } no estimate, and an unsized line adds nothing to the remaining work. The expected cost is a floor: the work is coming and nothing says what it costs.`,

  "no-scope": () =>
    "This project has no deliverables, so nothing says how much work is left. The expected cost and the overage are left out rather than shown as nought — the date below is when the money runs out, not when the project ends.",
};

/**
 * Every caveat on this projection, in words, in reading order.
 *
 * The order is `projectionCaveats`' own, which runs from the basis of the
 * forecast outwards: a reader who stops after the first bullet has read the
 * most fundamental thing wrong with the figures. Not sorted by grade, because
 * two `weak` caveats are not ranked against each other and a list that
 * reordered itself per project would stop being skimmable.
 *
 * Empty for a firm projection, and the panel renders nothing rather than a
 * bullet saying there is nothing to say. The lead sentence has already done
 * the qualifying that every grade needs.
 */
export function projectionCaveatSentences(
  projection: ProjectProjection,
): string[] {
  return projection.caveats.map((caveat) =>
    CAVEAT_SENTENCE[caveat](projection),
  );
}

/**
 * What is left of the contract when the work is done, with the sign read out
 * loud.
 *
 * Two words rather than a minus sign, for the reason `describeLineEnd` gives
 * about the end of the burn-down line: "-$4,000.00" in a column of amounts is
 * a figure a reader has to decode, and the decoding is the whole meaning.
 * "$4,000.00 over" is the sentence somebody repeats.
 *
 * The amount is flipped rather than printed negative, so the two readings are
 * the same shape and a column of them lines up on the digits.
 */
export function describeProjectedRemaining(forecast: BurnForecast): string {
  if (forecast.projectedRemainingCents < 0) {
    return `${formatCents(-forecast.projectedRemainingCents)} over`;
  }
  return `${formatCents(forecast.projectedRemainingCents)} left`;
}

/** What a date row says when the contract value has already gone. */
export const CONTRACT_ALREADY_GONE_LABEL = "Already gone";

/** What a date row says when the day it would name is past the horizon. */
export const BEYOND_HORIZON_LABEL = "Not within ten years";

/**
 * A forecast date, or the words that stand in for one.
 *
 * Three answers, and the two that are not a date are different facts. Past the
 * horizon means the arithmetic ran — there is a day count, and it is enormous
 * — so the words say the figure is out of range rather than absent. No day
 * count at all means the question did not apply, which for the contract row
 * means the money has already gone and for the work row cannot happen on a
 * projection this panel would draw.
 *
 * Takes the pair rather than the forecast, so the two rows share one function
 * instead of one branching on which row it is drawing.
 */
export function describeForecastDate(
  days: number | null,
  onDate: string | null,
): string {
  if (onDate !== null) return formatDate(onDate);
  if (days === null) return CONTRACT_ALREADY_GONE_LABEL;
  return BEYOND_HORIZON_LABEL;
}
