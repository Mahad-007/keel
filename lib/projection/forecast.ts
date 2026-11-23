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
export function daysToBurn(
  cents: number,
  centsPerDay: number,
): number | null {
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
