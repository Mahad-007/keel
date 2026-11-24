import { formatDate } from "@/lib/dates";
import { formatCents, withoutNegativeZero } from "@/lib/money";
import type {
  ProjectionCaveat,
  ProjectionConfidence,
} from "@/lib/projection/confidence";
import type { BurnForecast } from "@/lib/projection/forecast";
import { hasBurnRate, type BurnRate } from "@/lib/projection/rate";

import { NO_PRICE_TO_SHARE_LABEL } from "./burn-summary";
import type { PanelFigure } from "./figure";
import type { ProjectProjection } from "./projection";
import { formatSharePercent } from "./scope-summary";

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
 * They need remaining work with a value on it. Without one the remaining cost
 * is nought, so the projected final cost is the burn and the projected overage
 * is whatever has already been overspent — and a project with three months of
 * work ahead of it would read as expecting no overage at all. That is the one
 * place in this panel where a figure would be worse than a gap, because it is
 * wrong in the reassuring direction and looks like a measurement.
 *
 * Two states reach it and both are withheld. An empty scope list says nothing
 * about the work at all. A list whose open lines are all unsized — or whose
 * sized lines value at nought, on a project whose rate has been cleared — says
 * as little, and it is the more dangerous of the two because the lines are
 * there and the panel looks fully informed. The caveats tell a reader which,
 * in a sentence, with the count in it.
 *
 * The date the contract runs out survives, which is why the panel is still
 * drawn: it is worked out from the pace and the money, and neither of those
 * needs to know what the work is.
 *
 * Asked of the caveats rather than of the figures, so there is one place that
 * decides what a scope list with nothing to project means to a forecast and
 * the sentence explaining the gap cannot appear without the rows being
 * withheld.
 */
export function hasProjectedCost(projection: ProjectProjection): boolean {
  return !(
    projection.caveats.includes("no-scope") ||
    projection.caveats.includes("unvalued-scope")
  );
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
    "There is not enough behind this to extrapolate from with any " +
    "confidence — either too little measured history or nothing that says " +
    "how much work is left. It is shown because a pace worth worrying about " +
    "is worth seeing early, and it is not a figure to quote. What follows " +
    "says why.",
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
 *
 * A pace that rounds away is written as less than a cent rather than as
 * nought, the same way `formatSharePercent` writes "less than 1%". It takes a
 * rate of a cent or two an hour to reach, so it is a row somebody mistyped
 * rather than a project — but "$0.00 a day" sitting beside a date counted
 * forward at a positive pace is the one line on this panel that would look
 * like a contradiction, and a reader who found it would be right to distrust
 * everything above it.
 *
 * Only upwards, and the asymmetry is the point. A pace *below* nought is
 * reachable — an entry deleted between two readings leaves the window burning
 * backwards — and no date is ever counted at one: `hasBurnRate` refuses it, so
 * it reaches a reader only inside the `pace-changed` sentence, where it is
 * being compared against the average rather than extrapolated from. "Less than
 * a cent a day" there would claim a direction the figure does not have, so it
 * rounds to nought like any other sub-cent amount — through
 * `withoutNegativeZero`, because `Intl` keeps the sign and "-$0.00 a day"
 * reads as a broken page rather than as a pace that stood still.
 */
export function formatPace(centsPerDay: number): string {
  const cents = Math.round(centsPerDay);
  if (cents === 0 && centsPerDay > 0) return "less than a cent a day";
  return `${formatCents(withoutNegativeZero(cents))} a day`;
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
 * What the one surviving figure row says, for the two caveats that point at
 * it.
 *
 * Both scope caveats end by naming what is left on the panel once the cost
 * rows are withheld, and that row is not always a date. A sentence promising
 * one two inches above a row that refuses to give it is the same mistake in
 * miniature as a forecast with no caveats: the words claiming more than the
 * figures.
 *
 * Three answers, which are `describeForecastDate`'s three in prose. Already
 * gone is a project that overspent before the panel was drawn. Past the
 * horizon is a pace of a cent or two a day — a mistyped rate, usually — where
 * the arithmetic ran and landed in the 2050s, and `forecastDate` refuses to
 * name a day that far out rather than printing one.
 *
 * One clause, read by both sentences, so the pair cannot drift apart.
 */
function describeSurvivingRow(projection: ProjectProjection): string {
  const { daysOfContractLeft, contractRunsOutOn } = projection.forecast;
  if (daysOfContractLeft === null) {
    return "The row below says the contract value has already gone; nothing here says when the project ends.";
  }
  if (contractRunsOutOn === null) {
    return "The row below says the money lasts beyond the ten years a forecast here will name, which at this pace it does; nothing here says when the project ends.";
  }
  return "The date below is when the money runs out, not when the project ends.";
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

  "pace-changed": (projection) => {
    /*
      The recent pace, not `pace`. The two are usually the same figure —
      `forecastPace` prefers the recent one — but not when the recent window
      was quiet, and that is exactly a project this caveat fires on. Naming
      `pace` there would say the last fortnight ran at the average, which is
      the one number it did not run at.
    */
    const recent = projection.recentPace;
    const comparison =
      recent === null
        ? ""
        : `The last stretch ran at ${formatPace(
            recent.centsPerDay,
          )} against ${formatPace(
            projection.overallPace.centsPerDay,
          )} across the whole project. `;

    /*
      The same question `forecastPace` asked, asked again rather than inferred
      from which object came back. Comparing identities would be right today
      and would flip an accelerating project to "nothing has been burned
      recently" the first time a projection crossed a boundary that copied it
      — a server action's return value, a cache, a test fixture spread.
    */
    if (!hasBurnRate(recent)) {
      return `${comparison}Nothing has been burned recently, so the dates below are counted at the whole-project pace rather than the recent one — they assume the work picks up again.`;
    }
    return `${comparison}The dates below come from the recent figure, so they would sit ${
      projection.evidence.paceShift === "faster" ? "later" : "sooner"
    } if the project returned to its average.`;
  },

  "reconstructed-history": (projection) => {
    const { reconstructedCount: reconstructed, readingCount: total } =
      projection.evidence;
    const consequence =
      "Those hours are the hours that were logged, but valued at the rate and contract value the project carries now — so a rate that has moved since tilts the pace.";

    /*
      All of them is the ordinary case rather than the extreme one — nothing in
      this repo runs a nightly job, so a project read for the first time has
      its whole history worked out after the fact — and "14 of the 14 readings"
      is not how anybody says that. The share is only worth spelling out when
      it is a share.

      Greater *or equal*, though nothing produces greater: both counts are read
      off the same span in `projectionEvidence`, so a reconstruction cannot
      exceed a reading. If some later caller assembles the evidence otherwise,
      this says "all of them" rather than "nine of the eight".
    */
    if (reconstructed >= total) {
      const subject =
        total === 1
          ? "The one reading behind this pace was"
          : `All ${total} readings behind this pace were`;
      return `${subject} reconstructed after the fact rather than measured on the day. ${consequence}`;
    }

    return `${reconstructed} of the ${total} readings behind this pace ${
      reconstructed === 1 ? "was" : "were"
    } reconstructed after the fact rather than measured on the day. ${consequence}`;
  },

  "stale-readings": (projection) =>
    `No reading has been stored for this project for ${projection.evidence.daysSinceLastReading} days. The pace is a statement about a stretch that has already ended, and the dates are counted forward from today regardless.`,

  "unsized-scope": (projection) => {
    const subject =
      projection.evidence.unsizedUndeliveredCount === 1
        ? "One unfinished deliverable carries"
        : `${projection.evidence.unsizedUndeliveredCount} unfinished deliverables carry`;
    const problem = `${subject} no estimate, and an unsized line adds nothing to the remaining work.`;

    /*
      The consequence is only this caveat's to state while there is a figure
      to qualify. When nothing left in the list carries a value the cost rows
      are withheld altogether, and `unvalued-scope` — which fires on exactly
      that project, immediately below this — is the sentence that says so.
      Saying "the expected cost is a floor" there would point at a row that is
      not on the panel, and point at it first.
    */
    if (!hasProjectedCost(projection)) return problem;
    return `${problem} The expected cost is a floor: the work is coming and nothing says what it costs.`;
  },

  "unvalued-scope": (projection) => {
    /*
      No count of the lines. The figure this explains is valued from the
      *unfinished* ones, and a sentence counting the whole list would say "the
      work left in this project's ten deliverables comes to nothing" to
      somebody looking at a scope tab where eight of the ten are done and
      sized. The count that is worth having is the unsized one, and
      `unsized-scope` reports it one sentence above whenever it applies.

      The cause comes off the minutes against the money rather than off the
      unsized count, which is the only pair that can tell the two apart.
      Unsized lines are not the same fact as a worthless remainder: a project
      with one unsized line and one sized line still open has minutes left,
      and if those minutes come to nothing it is the rate that did it. Reading
      the unsized count instead would blame the scope list for a cleared rate
      and send somebody to the wrong form.
    */
    const cause =
      projection.evidence.remainingWorkMinutes > 0
        ? "the hours left in it are valued at a rate of nought or below"
        : "nothing unfinished in it carries an estimate the forecast can add";
    return `The work still to do in the scope list comes to nothing: ${cause}. The expected cost and the overage are left out rather than shown as the hours already logged — a floor of nought is not a forecast. ${describeSurvivingRow(projection)}`;
  },

  "no-scope": (projection) =>
    `This project has no deliverables, so nothing says how much work is left. The expected cost and the overage are left out rather than shown as nought. ${describeSurvivingRow(projection)}`,
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

/**
 * What the project is expected to have cost once the work is done.
 *
 * The first row, because everything under it is a reading of it. It is
 * deliberately a *cost* where the row above it on the tab is a *price*: a
 * reader setting the two side by side is making the comparison this whole
 * phase exists for.
 *
 * The note breaks the total back into its two halves, and they are not the
 * same kind of number. The burn is measured — those hours were logged, at a
 * rate somebody set. The rest is an estimate written before the work started.
 * A total that hid the split would invite a reader to trust all of it as much
 * as they trust the measured half.
 */
export function projectedCostFigure(
  projection: ProjectProjection,
): PanelFigure {
  return {
    label: "Expected to cost",
    value: formatCents(projection.forecast.projectedFinalCents),
    note: `${formatCents(
      projection.forecast.burnedCents,
    )} of hours already logged, plus ${formatCents(
      projection.forecast.remainingWorkCents,
    )} of unfinished estimates valued at this project's rate.`,
  };
}

/**
 * Where that leaves the contract: money still in it, or money past it.
 *
 * The row the milestone is named for. It is the subtraction a reader would
 * otherwise do between the row above and the contract value in the header, and
 * it earns a row because the sign is the whole answer and a sign is the
 * easiest thing to get wrong in your head.
 *
 * The note names the price it was taken against, so the figure can be checked
 * without scrolling, and an overage gets the consequence rather than a
 * restatement: hours past that point are hours nobody is paying for, which is
 * the sentence that makes somebody act.
 */
export function projectedContractFigure(
  projection: ProjectProjection,
): PanelFigure {
  const agreed = formatCents(projection.forecast.contractedCents);
  return {
    label: "Against the contract",
    value: describeProjectedRemaining(projection.forecast),
    note:
      projection.forecast.projectedOverageCents > 0
        ? `Past the ${agreed} agreed. Hours beyond that point are hours nobody is paying for.`
        : `Of the ${agreed} agreed, on this projection.`,
  };
}

/**
 * The projected cost as a share of the contract.
 *
 * The figure that travels: a percentage is what gets said out loud, and the
 * amounts above are what somebody checks it against afterwards. Through
 * `formatSharePercent`, so this share and the burn panel's own Consumed row an
 * inch above it round the same way — two roundings of one fraction on one
 * screen is the fastest way to make a reader distrust both.
 *
 * Unclamped, like the burn's. A projection of 168% is the single most useful
 * number this panel can print, and nothing stands between it and the reader.
 *
 * The note sets it against what has gone already, because the pair is the
 * point: 64% consumed now and 80% projected is a project with room, and 64%
 * now and 140% projected is the same first figure and a different engagement.
 */
export function projectedShareFigure(
  projection: ProjectProjection,
): PanelFigure {
  const share = projection.forecast.projectedShare;
  return {
    label: "Projected consumption",
    value: share === null ? NO_PRICE_TO_SHARE_LABEL : formatSharePercent(share),
    note: `${formatCents(projection.forecast.burnedCents)} of the ${formatCents(
      projection.forecast.contractedCents,
    )} agreed has gone so far.`,
  };
}

/**
 * The day the contract value runs out at this pace.
 *
 * The most actionable row on the panel, and the one with the shortest half
 * life. It is not the end of the project: it is the day the money stops, and
 * on an engagement heading over it comes first. Everything after it is worked
 * for nothing.
 *
 * The note says how many days away that is, because a date and a distance are
 * read differently — "May 23" is a thing to put in a calendar and "seventy
 * days" is a thing to weigh against the work left. Both, and the distance is
 * what makes the date checkable against the pace above it.
 */
export function contractRunsOutFigure(
  projection: ProjectProjection,
): PanelFigure {
  const days = projection.forecast.daysOfContractLeft;
  return {
    label: "Contract runs out",
    value: describeForecastDate(days, projection.forecast.contractRunsOutOn),
    note:
      days === null
        ? "The hours logged have already passed the contract value, so there is no day left to count to."
        : `${days === 1 ? "One day" : `${days} days`} of contract left at this pace.`,
  };
}

/**
 * The day the remaining work is expected to be paid for.
 *
 * The other end of the engagement, and the pair with the row above it is the
 * point: the gap between the two dates is the stretch that gets worked for
 * nothing, and a reader who can see both can decide whether to raise a change
 * order now or let it run.
 *
 * "Paid for" rather than "finished", deliberately. The forecast knows what the
 * remaining estimates come to and how fast money is being spent; it does not
 * know when anybody intends to deliver. A row labelled "Finishes" would be a
 * claim about a plan nobody has typed in, and the one thing worse than no
 * delivery date is one the app invented.
 */
export function workPaidForFigure(projection: ProjectProjection): PanelFigure {
  const days = projection.forecast.daysOfWorkLeft;
  return {
    label: "Remaining work paid for",
    value: describeForecastDate(days, projection.forecast.workPaidForOn),
    note:
      days === null
        ? "There is no pace to count the remaining work forward at."
        : `${formatCents(
            projection.forecast.remainingWorkCents,
          )} of estimates left, which is ${
            days === 1 ? "one day" : `${days} days`
          } at this pace.`,
  };
}

/**
 * The pace the two dates were counted forward at.
 *
 * Last, because it is the working rather than the conclusion — the same place
 * the burn panel keeps its own explanation. A reader who accepts the dates
 * never needs this row; a reader who finds one surprising needs it before
 * anything else on the panel, and it is one line down from where they are
 * already looking.
 */
export function paceFigure(projection: ProjectProjection): PanelFigure {
  return {
    label: "Burn rate",
    value: formatPace(projection.pace.centsPerDay),
    note: describePaceBasis(projection.pace),
  };
}

/**
 * The whole panel's figures, in the order they are read.
 *
 * Conclusions first and the working last, which is the order every figures
 * panel in this app keeps. The cost, then what it does to the contract, then
 * the share — the three in increasing order of how much they commit to — then
 * the two dates, then the pace they were counted at.
 *
 * Four of the six drop out when there is no scope list to project from, for
 * the reason `hasProjectedCost` gives: with nothing in the scope list those
 * rows would read as a project expecting no overage, which is the one figure
 * on this panel that would be wrong in the reassuring direction. The same
 * arrangement `burnFigures` makes when nobody has set a price.
 *
 * "Remaining work paid for" goes with them, and it is the one easiest to think
 * of as a date rather than as a cost. It is not: the day is the remaining
 * estimates divided by the pace, so with no estimates it is nought days and it
 * prints *today* — a project with three months of work ahead of it reporting
 * that its remaining work is paid for already. The only row that genuinely
 * survives an empty scope list is the day the money runs out, which needs no
 * opinion about what the work is, and the pace it was counted at.
 *
 * One array rather than six calls from the component, so the order is a
 * decision taken once in the place that explains it and a row added later
 * cannot land in a different position on a different screen.
 */
export function projectionFigures(
  projection: ProjectProjection,
): PanelFigure[] {
  if (!hasProjectedCost(projection)) {
    return [contractRunsOutFigure(projection), paceFigure(projection)];
  }

  return [
    projectedCostFigure(projection),
    projectedContractFigure(projection),
    projectedShareFigure(projection),
    contractRunsOutFigure(projection),
    workPaidForFigure(projection),
    paceFigure(projection),
  ];
}

/**
 * Where the project lands, in one sentence, at the top of the panel.
 *
 * The milestone in a line. A reader who gets no further than this has the
 * figure the whole day was built to produce — whether this engagement is
 * expected to cost more than it was sold for, and by how much — and they have
 * it with "at this pace" in front of it rather than as a bare amount.
 *
 * The overage leads when there is one, because it is the news. A project
 * landing inside its contract gets the remainder instead, in the same shape,
 * rather than the overage of nought that `overspentCents` would hand it: "no
 * overage expected" is a sentence that invites nobody to read the caveats, and
 * the remainder is the figure that says how much room there is.
 *
 * Both readings name the agreed price. It is in the header four inches up, and
 * repeating it is what makes the sentence checkable where it is read — a
 * figure a reader has to scroll to verify is one they verify once.
 *
 * With nothing to project the remaining work from, the sentence says what the
 * panel cannot do rather than dressing up what it can. The cost rows are
 * withheld in that case, and a lead sentence that quoted a projected cost of
 * exactly the burn would be the one place the withholding leaked. Which of the
 * two gaps it is changes the clause, because "no deliverables" and "no
 * estimates on the ones there are" send a reader to different forms.
 */
export function describeProjectedOutcome(
  projection: ProjectProjection,
): string {
  const { forecast } = projection;
  const agreed = formatCents(forecast.contractedCents);

  if (!hasProjectedCost(projection)) {
    const gap = projection.caveats.includes("no-scope")
      ? "There are no deliverables to project the remaining work from"
      : "The work left in the scope list comes to nothing to project from";

    /*
      The one row that survives the withholding is the day the money runs out,
      and on a project that has already overspent there is no such day — the
      figures row says "Already gone". Promising a reader how long the contract
      lasts and then answering that two inches below is the whole panel's
      argument inverted: the sentence has to offer what the figures can
      actually show.
    */
    if (forecast.daysOfContractLeft === null) {
      return `${gap}, so nothing here says what this project will end up costing. The ${agreed} agreed has already gone in hours logged, and every hour from here is past it.`;
    }

    return `${gap}, so nothing here says what this project will end up costing — only how long the ${agreed} agreed lasts at the pace it is being spent.`;
  }

  if (forecast.projectedOverageCents > 0) {
    return `At this pace, and if the remaining estimates are right, this project is expected to cost ${formatCents(
      forecast.projectedFinalCents,
    )} — ${formatCents(
      forecast.projectedOverageCents,
    )} more than the ${agreed} agreed.`;
  }

  return `At this pace, and if the remaining estimates are right, this project is expected to cost ${formatCents(
    forecast.projectedFinalCents,
  )}, which leaves ${formatCents(
    forecast.projectedRemainingCents,
  )} of the ${agreed} agreed.`;
}
