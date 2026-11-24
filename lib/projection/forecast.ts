import {
  consumedShare,
  overspentCents,
  remainingContractCents,
} from "@/lib/burn";
import { shiftCalendarDate } from "@/lib/dates";
import { burnedCents, type EffectiveRate } from "@/lib/rates";

/**
 * Where a project lands if it carries on the way it has been going.
 *
 * The phase so far reports the past: what has been burned, how fast, and what
 * share of the contract is gone. Every one of those is a measurement, and a
 * measurement is something to react to. This file is the first thing in the
 * app that says something about a day that has not happened yet — and that is
 * the whole value of it, because the only moment an overrun can still be
 * prevented is before it arrives.
 *
 * Two extrapolations meet here, from two different tables, and the pair is
 * what makes the answer worth printing:
 *
 *   - **How much more the work will cost.** The unfinished deliverables carry
 *     estimates; valued at the project's rate, they are what is still to be
 *     spent. Added to what has gone already, that is the expected final cost,
 *     and the amount by which it passes the contract value is the expected
 *     overage. This is the figure the milestone names.
 *   - **When that happens.** The burn rate is cents per day, so the money
 *     still to spend is a number of days, and a number of days from today is a
 *     date. The same arithmetic run against what is left of the *contract*
 *     rather than what is left of the *work* gives the other date a reader
 *     wants: the day the budget runs out.
 *
 * Both are conditional on the project continuing to behave as it has, and that
 * condition is doing a great deal of work. A pace measured over a fortnight of
 * one person's time says nothing about the fortnight somebody goes on holiday;
 * an estimate on an unfinished deliverable is a guess made before the work
 * started. So nothing in this file is presented as a prediction. It computes
 * what the arithmetic says and `confidence.ts` computes what is wrong with it,
 * and the panel is forbidden from printing the first without the second.
 *
 * Pure arithmetic over whole cents and whole days. Nothing reads a row and
 * nothing formats a string.
 */

/**
 * What the unfinished work is still expected to cost, in cents.
 *
 * The estimates on the deliverables nobody has finished, valued at the rate
 * the project bills at — `burnedCents`, the same conversion the burn itself
 * goes through, so a forecast and the figure it is added to round the same way
 * and the sum reconciles. A separate function doing the division would drift
 * from the panel above it by a cent on a long engagement, and the panel is the
 * figure people quote.
 *
 * It is an estimate of *cost*, not of price, and the difference is the point
 * of the whole phase. A fixed-price engagement is paid the contract value
 * whatever the remaining work comes to; what the remaining work comes to is
 * what it will have cost to earn it. Setting the two against each other is
 * where an overage comes from.
 *
 * Takes the minutes already totalled rather than the scope list, for the
 * reason `burnedCents` takes minutes rather than entries: the conversion
 * rounds, so converting each line and adding would come to less than
 * converting the sum. `remainingEstimatedMinutes` is what totals them, and it
 * is the one place in the app that decides a started line earns no credit.
 *
 * Negative minutes — only reachable from a hand-edited estimate — come back as
 * a negative cost rather than being clamped, so the forecast shows the
 * symptom and somebody goes and looks at the row. Zero minutes come back as
 * nothing, which is honest but has two readings: a project whose work is all
 * done, and a project whose lines were never sized. Those are different facts
 * and `confidence.ts` tells them apart, because only the scope list can.
 */
export function remainingWorkCents(
  remainingMinutes: number,
  rate: EffectiveRate,
): number {
  return burnedCents(remainingMinutes, rate);
}

/**
 * How many days it takes to burn an amount at a pace, or null when the pace
 * cannot get there.
 *
 * Rounded up, which is the one place in this file the arithmetic is
 * deliberately pessimistic — and the opposite direction from
 * `remainingMinutesAtRate`, which floors. Both err towards the warning. That
 * figure says how much more work the budget can afford and must never offer a
 * minute there is no money for; this says when the money runs out, and a date
 * rounded down would arrive a day before it had to. Whole days, because the
 * readings are stored a day at a time and a forecast to the nearest hour would
 * claim a precision the rows do not have.
 *
 * Nought for an amount of nothing or less, not a negative number of days. A
 * project with no work left finishes today rather than last week, and a budget
 * already overspent ran out in the past — which is a real fact, but one the
 * overrun figure states in cents and states exactly. Counting backwards from
 * today to guess the day it happened would be a date derived from a pace that
 * has since changed, printed next to the figures that actually know.
 *
 * Null when the pace is nought or below, which is `hasBurnRate`'s rule written
 * out in the only other place it is needed. At no pace the amount is never
 * burned: not in a very long time — never, and infinity is not a number of
 * days. The caller that has something to say about that case asks `hasBurnRate`
 * first; this one refuses to make up a figure for it.
 */
export function daysToBurn(cents: number, centsPerDay: number): number | null {
  if (centsPerDay <= 0) return null;
  if (cents <= 0) return 0;
  return Math.ceil(cents / centsPerDay);
}

/**
 * How far ahead a forecast is allowed to name a date: ten years.
 *
 * Past that there is no useful difference between a date and "never". A
 * project with four hours of estimate left and a pace of a few cents a day
 * works out at a date in the 2050s, and printing it would be the page's least
 * honest moment of the day — a precise-looking Thursday derived from a pace
 * that will not survive the week, sitting next to figures that are measured.
 * The day count is still reported, because "sixteen thousand days at this
 * pace" says exactly what is wrong; it is the date that would be a lie.
 *
 * It is also what keeps the arithmetic inside the dates the helpers can
 * represent. `shiftCalendarDate` refuses a year past 9999 rather than wrapping,
 * which is right, and a projection of a few million days would reach it and
 * throw — turning a page with one surprising estimate on it into a page that
 * does not render. Ten years is far enough that nothing real is lost and near
 * enough that nothing can overflow.
 */
export const FORECAST_HORIZON_DAYS = 3650;

/**
 * The date a number of days from today lands on, or null when it is further
 * off than a forecast can honestly name.
 *
 * Today itself for nought days, which is what `daysToBurn` answers for work
 * that is already done or a budget already gone. A caller that wants to say
 * something different about those cases has the figures to tell them apart;
 * this one answers the question it was asked.
 *
 * Null rather than a clamped date at the horizon, because a date at the
 * horizon would be read as a forecast of that date. "Not within ten years" is
 * what is actually known, and only an absent date can say it.
 *
 * Null for a negative day count too, which nothing produces — `daysToBurn`
 * floors at nought — but which would otherwise forecast a date in the past,
 * and a date in the past read as a projection is the one mistake here that
 * would look authoritative.
 */
export function forecastDate(today: string, days: number): string | null {
  if (days < 0 || days > FORECAST_HORIZON_DAYS) return null;
  return shiftCalendarDate(today, days);
}

/**
 * What a forecast is worked out from: today, the money, and the pace.
 *
 * Four plain numbers and a date rather than a project, a client, a scope list
 * and a set of readings. Everything that had to be decided — which rate
 * applies, what counts as delivered, which days the pace was measured over —
 * has been decided by the time the arguments get here, which is what makes the
 * arithmetic testable without a database and reviewable without holding four
 * other files in mind. `lib/projects/projection.ts` is where the rows turn
 * into this.
 *
 * `burnedCents` is the live figure from the burn summary rather than the last
 * stored reading, and the distinction matters on the day. A reading is the
 * state at the end of its day; the summary includes an hour logged ten minutes
 * ago. Forecasting from the reading would quietly ignore today's work, and
 * today's work is the most likely thing to have prompted somebody to open the
 * page.
 *
 * `centsPerDay` arrives as a bare number rather than as a `BurnRate` because
 * the forecast does not care which span it was measured over — that is a
 * question about how much to believe the answer, and it belongs to the
 * confidence layer and the words. Taking the rate whole here would invite this
 * file to start having opinions about it.
 */
export type ForecastBasis = {
  /** The day the forecast is made on: `YYYY-MM-DD`. */
  readonly today: string;
  /** What the engagement was agreed for, in cents. */
  readonly contractedCents: number;
  /** What the hours logged so far have come to, in cents. */
  readonly burnedCents: number;
  /** What the unfinished estimates are expected to cost, in cents. */
  readonly remainingWorkCents: number;
  /** The pace to carry forward: cents per day, unrounded. */
  readonly centsPerDay: number;
};

/**
 * Where the project lands: what it will have cost, by how much that passes
 * the contract, and when.
 *
 * Four money figures and two dates, every one of them derived from the same
 * basis so they cannot disagree with each other. A panel showing an overage
 * worked out from one set of assumptions and a date worked out from another is
 * the failure this shape exists to prevent — and it is an easy one to reach,
 * because the two come from different tables.
 *
 * The price and the two halves of the sum are echoed through rather than
 * consumed. A projected cost is a sum of two very different things — money
 * that has been spent and money that is a guess — and a reader who finds the
 * total surprising wants to know which half surprised them. The words under
 * the figure say so, and without the halves travelling with the total they
 * would have to be handed the basis separately and could be handed a
 * different one. The price travels for the same reason: every comparison on
 * the panel is against it, and a caller that had to supply it alongside could
 * supply a different one.
 *
 * The dates are nullable and the figures are not, which is the asymmetry of
 * the two extrapolations. What the work will cost needs an estimate and a
 * rate, and both are in hand by the time a forecast is made at all. *When*
 * needs a pace as well, and a project can have a price, a rate and a scope
 * list while having burned nothing — at which point the cost is knowable and
 * the date is not.
 */
export type BurnForecast = {
  /** What the engagement was agreed for, as the basis carried it. */
  readonly contractedCents: number;
  /** What the hours logged so far had come to, as the basis carried it. */
  readonly burnedCents: number;
  /** What the unfinished estimates are expected to cost, as the basis carried it. */
  readonly remainingWorkCents: number;
  /** What the project is expected to have cost when the work is done. */
  readonly projectedFinalCents: number;
  /** How far that passes the contract value, in cents. Nought if it does not. */
  readonly projectedOverageCents: number;
  /** Contracted less the projected final cost. Below zero means an overage. */
  readonly projectedRemainingCents: number;
  /** The projected final cost as a share of the contract, or null with no price. */
  readonly projectedShare: number | null;
  /** Days of work left at this pace, or null when the pace cannot get there. */
  readonly daysOfWorkLeft: number | null;
  /** The day the remaining work is expected to be paid for, within the horizon. */
  readonly workPaidForOn: string | null;
  /** Days until the contract value is all burned, or null when it already is. */
  readonly daysOfContractLeft: number | null;
  /** The day the contract value runs out, within the horizon. */
  readonly contractRunsOutOn: string | null;
};

/**
 * The whole forecast for one project: what it will cost, what that costs
 * against the contract, and when it arrives.
 *
 * Every money figure goes through the functions `lib/burn.ts` already uses for
 * the present-tense versions — `overspentCents`, `remainingContractCents`,
 * `consumedShare` — with the projected final cost in place of the burn. That
 * is the point of reusing them rather than writing three more subtractions:
 * the projected share and the current share are the same arithmetic over
 * different inputs, so the panel can set one beside the other and the reader
 * is comparing like with like. It also means the three decisions those
 * functions encode — that a remainder may go below zero, that an overrun may
 * not, that a share of a price of nothing is absent rather than nought — are
 * taken once for both tenses.
 *
 * The two dates answer two different questions and are deliberately both here.
 * "When does the work get paid for" is the end of the engagement: the point at
 * which the remaining estimates have been worked through. "When does the
 * contract run out" is the end of the money, and on a project heading for an
 * overage it comes first — the gap between the two dates is the stretch that
 * gets worked for nothing, and it is the most actionable thing on the page.
 *
 * The contract date is null once the money has already gone, rather than
 * today. `daysToBurn` floors at nought, so without this the page would say the
 * budget runs out today for a project that overspent it in February — a
 * sentence that is wrong in the one direction that matters, because it reads
 * as a deadline rather than as a fact. The overage figures are what speak for
 * that project, and they are exact.
 */
export function forecastBurn(basis: ForecastBasis): BurnForecast {
  const projectedFinalCents = basis.burnedCents + basis.remainingWorkCents;
  const daysOfWorkLeft = daysToBurn(
    basis.remainingWorkCents,
    basis.centsPerDay,
  );

  const contractLeftNow = remainingContractCents(
    basis.contractedCents,
    basis.burnedCents,
  );
  const daysOfContractLeft =
    contractLeftNow <= 0
      ? null
      : daysToBurn(contractLeftNow, basis.centsPerDay);

  return {
    contractedCents: basis.contractedCents,
    burnedCents: basis.burnedCents,
    remainingWorkCents: basis.remainingWorkCents,
    projectedFinalCents,
    projectedOverageCents: overspentCents(
      basis.contractedCents,
      projectedFinalCents,
    ),
    projectedRemainingCents: remainingContractCents(
      basis.contractedCents,
      projectedFinalCents,
    ),
    projectedShare: consumedShare(basis.contractedCents, projectedFinalCents),
    daysOfWorkLeft,
    workPaidForOn:
      daysOfWorkLeft === null
        ? null
        : forecastDate(basis.today, daysOfWorkLeft),
    daysOfContractLeft,
    contractRunsOutOn:
      daysOfContractLeft === null
        ? null
        : forecastDate(basis.today, daysOfContractLeft),
  };
}
