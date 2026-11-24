import type { BurnSummary } from "@/lib/burn";
import { reconstructedSince, type BurnReading } from "@/lib/burndown/reading";
import { calendarDayGap } from "@/lib/dates";
import {
  projectionCaveats,
  projectionConfidence,
  type ProjectionCaveat,
  type ProjectionConfidence,
  type ProjectionEvidence,
} from "@/lib/projection/confidence";
import {
  forecastBurn,
  remainingWorkCents,
  type BurnForecast,
} from "@/lib/projection/forecast";
import {
  classifyPaceShift,
  forecastPace,
  hasBurnRate,
  overallBurnRate,
  paceChangeRatio,
  recentBurnRate,
  windowCoversWholeHistory,
  type BurnRate,
} from "@/lib/projection/rate";
import {
  allDelivered,
  remainingEstimatedMinutes,
  unestimatedUndeliveredCount,
  type ScopeLine,
} from "@/lib/scope";

import { hasPriceToMeasureAgainst } from "./burn-summary";

/**
 * Where a project's projection comes from.
 *
 * `lib/projection/` is three modules of arithmetic that know nothing about
 * each other's inputs: the rate reads a list of readings, the forecast reads
 * six numbers, and the confidence reads a set of counts. That is right for all
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
  /**
   * The counts the caveats were read off.
   *
   * Carried rather than consumed, because a caveat is only worth printing
   * quantified. "Some unfinished deliverables have no estimate" leaves a
   * reader to go and count them; "two of the five unfinished lines are
   * unsized" tells them how much of the forecast is a floor and which form to
   * open. The words module reads these rather than taking the scope list and
   * the readings again, so the sentence under a caveat and the caveat itself
   * can never be about different numbers.
   *
   * It also carries `paceShift`, which is the comparison the words name when
   * they explain which pace the date came from.
   */
  readonly evidence: ProjectionEvidence;
  /** Where the project lands if it carries on this way. */
  readonly forecast: BurnForecast;
  /** Everything wrong with the basis of that forecast, in reading order. */
  readonly caveats: readonly ProjectionCaveat[];
  /** How much of it to believe, folded from the caveats. */
  readonly confidence: ProjectionConfidence;
};

/**
 * The counts the caveats are read off, gathered from the readings, the scope
 * list, the valued remainder and the clock.
 *
 * Not numbered in the prose. The count has been wrong twice today alone —
 * eight, then nine — because a field arrives and the sentence above it does
 * not, and a doc comment that goes stale every time the type grows teaches a
 * reader to stop believing the rest of it. The type is the list.
 *
 * The two history counts come from the pace that was actually used rather than
 * from the readings as a whole, which is the point of passing it in. A project
 * six months old whose forecast was carried forward from a fortnight has a
 * fortnight of evidence behind its date, and reporting six months would be
 * vouching for days the arithmetic never touched. The reconstruction count is
 * bounded the same way, by the span the pace was measured over.
 *
 * `remainingWorkCents` arrives already valued rather than being worked out
 * from the lines here, because `projectProjection` has to hand the same figure
 * to the forecast. Two valuations of one scope list is how a panel ends up
 * withholding a cost it has already printed.
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
  remainingCents: number,
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
    remainingWorkCents: remainingCents,
    /*
      The minutes are read off the lines here rather than passed in, unlike
      the money beside them. A valuation is a decision — which rate, rounded
      how — and two of those can disagree; a total of a column of minutes is
      the same function over the same rows whichever caller runs it, and the
      counts above it are already read that way.
    */
    remainingWorkMinutes: remainingEstimatedMinutes(lines),
  };
}

/**
 * A project's whole projection, or null when there is nothing to project.
 *
 * Four refusals, in the order that costs the least to check, and each one is a
 * state where a figure would be worse than no figure:
 *
 *   - **No readings.** A project nothing has been logged against has no pace,
 *     and a forecast of nought a day would promise the contract lasts for
 *     ever. The burn panel above already says the whole contract is intact.
 *   - **No usable pace.** Readings that have burned nothing, or burned
 *     backwards. Dividing by that pace is `daysToBurn`'s refusal, and every
 *     date would come back absent — a panel of empty rows, which says less
 *     than no panel.
 *   - **No price.** An overage is an amount past the contract value, and with
 *     no contract value every cent of the projected cost is past it. The
 *     figure would be arithmetically true and would read as a catastrophe on
 *     a project nobody has priced yet. `hasPriceToMeasureAgainst` is the same
 *     test the burn panel's own comparisons wait on.
 *   - **Everything delivered.** There is no remaining work, so the forecast is
 *     the present tense: it would say the project finishes today at what it
 *     has already cost, which is true, and which the panel above has said in
 *     plainer words. A finished project does not need a projection; it needs
 *     an invoice.
 *
 * Null rather than a projection carrying a "nothing to say" flag, because
 * every one of those cases is a reason for the panel not to exist rather than
 * a caveat on its contents. The caveats are for a forecast that *is* worth
 * printing — which is most of them, and the thin ones are graded `weak` and
 * shown, because withholding the figure from the project with three days of
 * frightening readings would be the one refusal that costs somebody money.
 *
 * The scope list arrives as rows rather than as a remaining total, because
 * three different things are read off it: what the remaining work costs, how
 * many lines there are at all, and how many unfinished ones nobody sized. A
 * caller handing over one total could not produce the other two, and a caller
 * handing over all three could get them out of step.
 */
export function projectProjection(
  summary: BurnSummary,
  lines: readonly ScopeLine[],
  readings: readonly BurnReading[],
  today: string,
): ProjectProjection | null {
  const overallPace = overallBurnRate(readings);
  if (overallPace === null) return null;

  const recentPace = recentBurnRate(readings);
  const pace = forecastPace(overallPace, recentPace);
  if (!hasBurnRate(pace)) return null;

  if (!hasPriceToMeasureAgainst(summary)) return null;
  if (allDelivered(lines)) return null;

  /*
    Valued once, for the forecast and for the evidence alike. The caveat that
    says there is no cost to project is read off this figure and so is the cost
    itself, and a second valuation here is how the panel would come to withhold
    a figure it had already printed.
  */
  const remainingCents = remainingWorkCents(
    remainingEstimatedMinutes(lines),
    summary.rate,
  );

  const evidence = projectionEvidence(
    pace,
    overallPace,
    recentPace,
    readings,
    lines,
    remainingCents,
    today,
  );
  const caveats = projectionCaveats(evidence);

  return {
    pace,
    overallPace,
    recentPace,
    evidence,
    forecast: forecastBurn({
      today,
      contractedCents: summary.contractedCents,
      burnedCents: summary.burnedCents,
      remainingWorkCents: remainingCents,
      centsPerDay: pace.centsPerDay,
    }),
    caveats,
    confidence: projectionConfidence(caveats),
  };
}
