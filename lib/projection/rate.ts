import type { BurnReading } from "@/lib/burndown/reading";
import { inclusiveDayCount, shiftCalendarDate } from "@/lib/dates";

/**
 * How fast a project is spending its contract, measured from its own history.
 *
 * Every figure the phase has produced so far is a state: what has been burned,
 * what is left, what share has gone. None of them is a *pace*, and a pace is
 * what turns a measurement into a warning. Sixty percent consumed is a fact
 * about the past; sixty percent consumed at four thousand dollars a week is a
 * date in the near future, and the date is the thing somebody can still do
 * something about.
 *
 * The readings are already stored — one row per day, each carrying what the
 * whole engagement had burned by the end of it — so a rate is a difference
 * between two of them over the days between. That is all this file does, and
 * it does it twice on purpose: over the whole observed span, and over the last
 * couple of weeks. A projection built on one of those and silent about the
 * other would be a confident number with its own refutation sitting unread in
 * the next column. Day 037's whole claim is that the caveats are surfaced, and
 * the first caveat worth surfacing is that the project's recent pace and its
 * average pace are not the same number.
 *
 * Cents per *day*, not per week and not per working day. A day is the unit the
 * readings are stored in, so it is the only one the arithmetic can be exact
 * in; weeks and working days are presentation, and a rate that quietly assumed
 * a five-day week would be wrong by two sevenths for the retainer somebody
 * services on a Sunday. The words module is where a daily figure becomes a
 * weekly one for a reader.
 *
 * Nothing here reads a row or formats a string. Readings in, rates out, and
 * the rate is a plain unrounded number of cents per day — the one figure in
 * this repo that is deliberately not a whole number of cents, because it is a
 * ratio rather than an amount and rounding it would compound over a forecast.
 */

/**
 * A measured pace: what was burned, over how long, and between which days.
 *
 * The span travels with the figure because a rate cannot be read without it.
 * Four thousand dollars a day is a plausible pace for a team of six and an
 * impossible one for a sole trader, and the difference between a rate worth
 * forecasting from and a rate that is noise is almost always how many days it
 * was measured over — one busy Tuesday says nothing about March.
 *
 * `burnedCents` is the burn *accrued across the span*, not the cumulative
 * total at the end of it. For a rate measured over a project's whole history
 * those are the same number; for a recent window they are not, and keeping the
 * accrued figure is what lets the two kinds of rate be the same shape.
 *
 * `readingCount` is how many stored days the span was measured from, which is
 * the other half of trusting it. A fortnight holding two readings and a
 * fortnight holding fourteen give the same arithmetic and deserve different
 * amounts of belief, and only the count can tell them apart.
 */
export type BurnRate = {
  /** The first day the pace was measured across: `YYYY-MM-DD`. */
  readonly fromDate: string;
  /** The last day of it, which is the same day for a span of one. */
  readonly toDate: string;
  /** Days covered, both ends counted. Always one or more. */
  readonly elapsedDays: number;
  /** What was burned across those days, in cents. */
  readonly burnedCents: number;
  /** The pace: cents per day, unrounded. */
  readonly centsPerDay: number;
  /** How many stored readings the span was measured from. */
  readonly readingCount: number;
};

/**
 * The pace a burn over a span comes to, in cents per day, or null when the
 * span cannot be divided by.
 *
 * Null rather than zero for a span of no days, for the reason `consumedShare`
 * refuses a contract of nothing: dividing by it gives infinity, and a project
 * reporting an infinite burn rate because its dates arrived backwards is a
 * page blaming the reader for a bug. A span of nought or fewer days is only
 * reachable from a caller that measured its ends the wrong way round, and
 * there is no honest pace to report for it.
 *
 * The burn itself is divided as it comes, sign and all. A negative accrual is
 * reachable — a time entry deleted between two readings leaves the later one
 * holding fewer minutes than the earlier — and it comes back as a negative
 * pace rather than being clamped at nought, because a project whose burn went
 * *down* is a fact somebody should see rather than a project that stood still.
 * `hasBurnRate` is what refuses to forecast from it.
 *
 * Unrounded, and it is the one figure in the repo that is allowed not to be a
 * whole number of cents. It is a ratio rather than an amount: rounding
 * £1,234.56 over seven days to the nearest cent costs nothing, but rounding it
 * and then multiplying by ninety days compounds the error into real money.
 * Everything built on it rounds at the end instead.
 */
export function centsPerDay(
  burnedCents: number,
  elapsedDays: number,
): number | null {
  if (elapsedDays <= 0) return null;
  return burnedCents / elapsedDays;
}

/**
 * The pace a project has burned at across its whole recorded history, or null
 * when there is no history to measure.
 *
 * The baseline is nought, not the first reading's own figure, and that is the
 * decision worth defending. A stored reading holds what the *whole*
 * engagement had burned by the end of its day, so the first one already
 * contains the first day's work — subtracting it would throw that day away and
 * answer a rate of nothing for a project worked on exactly once. The span is
 * counted the matching way, with both ends included, so the first day is
 * divided by as well as counted: one reading of twelve thousand cents is a
 * pace of twelve thousand cents a day, which is the only reading of it that
 * reconciles with the figure on the chart.
 *
 * Measured from the ends of the list rather than by summing the differences
 * between consecutive readings. They come to the same total, and the ends are
 * the pair that cannot drift: a reading deleted from the middle changes
 * nothing, and a figure that depended on which days happened to carry a row
 * would move every time the backfill filled a gap in.
 *
 * It is the pace for the days the project was *observed*, not for the days
 * since it was agreed. The burn-down starts on the first day time was logged,
 * because that is the first thing the rows know about — a project signed in
 * January and started in March has burned its March money over March, and
 * dividing it across the two idle months would halve the pace and double the
 * forecast. The sentence under the chart already says the line starts where it
 * starts; this inherits the same honesty, and the words module says so again.
 *
 * Null for an empty list, which is a project nothing has been logged against:
 * no pace, as opposed to a pace of nothing. The distinction is the same one
 * `consumedShare` draws, and it matters here for the same reason — a forecast
 * built on a pace of nought would promise the contract would last for ever.
 */
export function overallBurnRate(
  readings: readonly BurnReading[],
): BurnRate | null {
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (first === undefined || last === undefined) return null;

  const elapsedDays = inclusiveDayCount(first.onDate, last.onDate);
  const perDay = centsPerDay(last.burnedCents, elapsedDays);
  if (perDay === null) return null;

  return {
    fromDate: first.onDate,
    toDate: last.onDate,
    elapsedDays,
    burnedCents: last.burnedCents,
    centsPerDay: perDay,
    readingCount: readings.length,
  };
}

/**
 * Whether this pace can actually be forecast from.
 *
 * Above nought, not merely present, which is the same test `hasRate` makes of
 * a rate and for the same reason. A pace of nothing divides into any remaining
 * amount as infinity: the contract would last for ever, the project would
 * never finish, and the page would report the most alarming kind of project —
 * one with hours logged that nobody can value — as the one with no end date to
 * worry about. A pace below nought is worse and gets the same answer, because
 * extrapolating it forecasts a project that pays its own contract back.
 *
 * Takes the nullable rate rather than a `BurnRate`, so a caller holding the
 * result of a measurement can ask one question instead of two. The absent case
 * and the unusable case are different facts — the words module tells them
 * apart — but every arithmetical caller treats them the same, and making each
 * one spell out `rate !== null && rate.centsPerDay > 0` is three chances to
 * get the second half wrong.
 */
export function hasBurnRate(rate: BurnRate | null): boolean {
  return rate !== null && rate.centsPerDay > 0;
}

/**
 * How many days back the recent pace is measured over.
 *
 * A fortnight, which is the shortest window that survives a week off. Shorter
 * and the figure moves every time somebody takes a Friday; longer and it stops
 * being recent — a month-long window on a three-month engagement is most of
 * the average it is supposed to be compared against, and the comparison it
 * exists to make would always agree.
 *
 * Measured in calendar days rather than in readings, deliberately. Fourteen
 * readings on a project worked every day is a fortnight; fourteen readings on
 * a project worked one day a week is a quarter, and a "recent" pace reaching
 * back to the spring would be the opposite of what the word promises. Idle
 * days are part of the pace — a project that did nothing for ten days has
 * genuinely slowed — so the window has to count them.
 *
 * One constant, exported, because Day 038 is where thresholds become
 * configurable per client and per project and this is one of the numbers that
 * will move there. Until then it is a default with its reasoning attached
 * rather than a number inlined at its only caller.
 */
export const RECENT_RATE_WINDOW_DAYS = 14;

/**
 * The first day a window of `windowDays` ending on `toDate` covers.
 *
 * One less than the window, not the whole window, because both ends are
 * counted: a fortnight ending on the 14th starts on the 1st, and shifting back
 * a full fourteen would reach the previous month and measure fifteen days.
 * That is the same off-by-one `inclusiveDayCount` exists to settle, from the
 * other direction, which is why it is written down here rather than at the
 * caller.
 *
 * Ends on the last day a reading was stored, not on today, and the caller is
 * what decides that. A project whose last reading is three weeks old would
 * have an empty window if the window ended today, and an empty window is not a
 * pace of nothing — it is no measurement at all, which would silently withdraw
 * the forecast from exactly the projects whose readings have gone quiet. The
 * staleness is a caveat instead, said out loud, and the pace is measured over
 * the days that were actually observed.
 *
 * Throws on a window of fewer than one day, like the date helpers throw on a
 * string that is not a date: a window of nought covers no days, a negative one
 * covers days after its own end, and both are a mistake in code rather than a
 * state a row can reach.
 */
export function rateWindowStart(toDate: string, windowDays: number): string {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new Error(`not a window of whole days: ${windowDays}`);
  }
  return shiftCalendarDate(toDate, -(windowDays - 1));
}

/**
 * The pace a project has burned at over the recent window, or null when there
 * is no history to measure.
 *
 * The same arithmetic as `overallBurnRate` over a shorter span, and it exists
 * to disagree with it. A project three months in that has spent the last
 * fortnight at twice its average pace is the project Day 037 is for, and an
 * average is exactly the figure that hides it: the busy fortnight is one
 * sixth of the span, so it moves the average by a sixth of the difference and
 * the forecast lands a month late. Measuring both and saying when they part
 * company is cheaper than choosing, and more honest than either.
 *
 * The window is a fixed stretch of calendar days ending at the **last stored
 * reading**, clamped so it never reaches back past the first one. Both halves
 * of that matter:
 *
 *   - Ending at the last reading rather than at today means a project whose
 *     rows have gone quiet still has a measurable recent pace. A window ending
 *     today would be empty for it, and an empty window is not a pace of
 *     nothing — it is no reading at all, which would withdraw the forecast
 *     from precisely the projects nobody has looked at. The gap between that
 *     last reading and today is a caveat instead, and it is said out loud.
 *   - Clamping the start at the first reading means a project five days old
 *     is measured over five days and not fourteen. Without it the nine days
 *     before the engagement existed would be counted as nine days of nothing,
 *     and a brand-new project burning hard would report a third of its real
 *     pace — the forecast would be wrong in the direction that reassures.
 *
 * The baseline is the last reading *before* the window opened, because a
 * stored figure is cumulative: what the window burned is what the project has
 * burned now less what it had burned when the window opened. Nought when no
 * reading precedes the window, which is the clamped case and makes this the
 * same figure as the overall pace — two names for one measurement, which is
 * the truth about a project younger than the window and something the
 * confidence layer says rather than hides.
 *
 * A reading dated before the window with no reading between it and the window
 * is taken at its word: the rows are written on the days work was logged, so
 * nothing recorded in between means nothing known to have been burned in
 * between. That is the assumption this file makes, it is the same one the
 * chart's flat stretches make, and it is the reason the window can be a fixed
 * number of days rather than a span the data chooses.
 */
export function recentBurnRate(
  readings: readonly BurnReading[],
  windowDays: number = RECENT_RATE_WINDOW_DAYS,
): BurnRate | null {
  const first = readings[0];
  const last = readings[readings.length - 1];
  if (first === undefined || last === undefined) return null;

  const windowStart = rateWindowStart(last.onDate, windowDays);
  const fromDate = windowStart < first.onDate ? first.onDate : windowStart;

  const before = readings.filter((reading) => reading.onDate < fromDate);
  const baselineCents = before[before.length - 1]?.burnedCents ?? 0;

  const elapsedDays = inclusiveDayCount(fromDate, last.onDate);
  const burned = last.burnedCents - baselineCents;
  const perDay = centsPerDay(burned, elapsedDays);
  if (perDay === null) return null;

  return {
    fromDate,
    toDate: last.onDate,
    elapsedDays,
    burnedCents: burned,
    centsPerDay: perDay,
    readingCount: readings.length - before.length,
  };
}

/**
 * The recent pace as a multiple of the overall one, or null when there is
 * nothing to divide by.
 *
 * A ratio rather than a difference in cents, because what a reader needs is
 * the shape of the change and not its size: "twice as fast as its average" is
 * a sentence somebody acts on at any scale, and "$1,840.00 a day faster" is a
 * figure they have to hold the average beside before it means anything. It is
 * also the form the threshold is expressed in, so a small project and a large
 * one are judged by the same number.
 *
 * Both paces have to be present and the overall one has to be above nothing.
 * Dividing by a pace of nought gives infinity, and a project that burned
 * nothing on average but something recently is better described by saying the
 * work has only just started than by a ratio of infinity — which the
 * confidence layer does, because it can see the reading count.
 *
 * A negative recent pace divides through to a negative ratio rather than being
 * refused. It means the burn went backwards in the window, which happens when
 * an entry is deleted, and the classifier below reads anything that far below
 * one as a project that has slowed — which it has, past standing still.
 */
export function paceChangeRatio(
  overall: BurnRate | null,
  recent: BurnRate | null,
): number | null {
  if (overall === null || recent === null) return null;
  if (overall.centsPerDay <= 0) return null;
  return recent.centsPerDay / overall.centsPerDay;
}

/**
 * How the recent pace stands against the average: the same, faster, or
 * slower.
 *
 * Three words rather than the ratio, because the ratio is what the forecast is
 * sensitive to and not what anybody needs to read. A projection built on an
 * average is trustworthy exactly to the extent that the recent weeks resemble
 * it, and "faster" is the whole of what a reader has to know to distrust the
 * date on the page — the figure behind it is there for the ones who want it.
 */
export const PACE_SHIFTS = ["steady", "faster", "slower"] as const;

export type PaceShift = (typeof PACE_SHIFTS)[number];

/**
 * How far the recent pace has to part from the average before it is worth
 * saying so: a quarter, either way.
 *
 * Below that, two paces measured over different spans of the same engagement
 * are the same pace with different amounts of a quiet weekend in them. A
 * fortnight containing one bank holiday is ten percent off its own average
 * before anybody has changed how they work, and a page that reported that as a
 * slowdown would cry wolf on every project every other week — at which point
 * the one project that really has doubled its pace is one amber note among
 * forty.
 *
 * Symmetrical in the ratio rather than in the forecast it implies, which is
 * worth naming because the two are not the same. A quarter faster brings a
 * date forward by a fifth; a quarter slower pushes it back by a third. The
 * threshold is about whether the two measurements disagree, not about how much
 * the disagreement costs, so the test is on the pace and the cost is left to
 * the figures.
 *
 * Exported, like `NEARLY_SPENT_SHARE` and the window beside it, because Day
 * 038 is where these become per-client settings.
 */
export const PACE_SHIFT_THRESHOLD = 0.25;

/**
 * Which way the pace has moved, or null when there is no ratio to judge.
 *
 * Null rather than `steady` for a missing ratio, which is the distinction this
 * file keeps everywhere: "the two paces agree" is a measurement and "there are
 * not two paces to compare" is a gap, and a page that printed the first when
 * it meant the second would be vouching for a comparison nobody made.
 *
 * The bounds are inclusive on both sides, so a pace exactly a quarter up is
 * faster and one exactly a quarter down is slower. An arbitrary choice at the
 * boundary, taken in the direction of saying something: the threshold is there
 * to suppress noise, and a figure that has reached it exactly is no longer
 * noise.
 */
export function classifyPaceShift(ratio: number | null): PaceShift | null {
  if (ratio === null) return null;
  if (ratio >= 1 + PACE_SHIFT_THRESHOLD) return "faster";
  if (ratio <= 1 - PACE_SHIFT_THRESHOLD) return "slower";
  return "steady";
}

/**
 * Whether the recent window reaches back over the whole of the project's
 * history, which makes the two paces one measurement.
 *
 * A project younger than the window has no recent pace distinct from its
 * average, and the ratio between them is exactly one. Read without this, that
 * one is indistinguishable from a three-month engagement whose last fortnight
 * happened to match its average — and the two deserve opposite amounts of
 * belief. The second is a corroboration: two spans, same answer. The first is
 * a single short measurement reported twice, and a page that let it pass for
 * agreement would be quoting one reading as though it were two.
 *
 * Compared on the elapsed days rather than on the dates, because that is the
 * span each pace was actually divided by — and `recentBurnRate` clamps its
 * start at the first reading, so the two spans coincide exactly when the clamp
 * bit. Greater *or equal* rather than equal, so a window longer than the
 * history reads the same as one that matches it; nothing produces that today,
 * and a predicate that failed open on it would fail in the direction of
 * claiming corroboration.
 */
export function windowCoversWholeHistory(
  overall: BurnRate | null,
  recent: BurnRate | null,
): boolean {
  if (overall === null || recent === null) return false;
  return recent.elapsedDays >= overall.elapsedDays;
}

/**
 * Which of the two paces to carry forward: the recent one when it is usable,
 * else the average.
 *
 * The recent fortnight is the better predictor of the next fortnight, and by a
 * long way on an engagement that has changed shape. A project five months in
 * that has spent its last two weeks at six times its average pace has an
 * average that is five-sixths history: forecasting from it lands the date
 * months late, which is the one direction a warning must not be wrong in.
 *
 * It falls back when the recent window is unusable rather than reporting no
 * pace, and the case that matters is a fortnight nobody worked. A pace of
 * nothing there is a true measurement and a terrible forecast — the work in
 * the scope list has not gone away because somebody took a holiday, and a
 * project whose remaining estimates would take four months reading "no
 * projected finish" is worse than one reading a date from its average. So a
 * quiet window defers to the whole history, which is the longest-standing
 * evidence there is.
 *
 * Which pace was used is not recorded in the result, deliberately. Both are
 * carried side by side into the projection and the words name the one the date
 * came from, so a reader can see the choice rather than having to trust it —
 * and the `pace-changed` caveat fires off the comparison whichever way the
 * choice went.
 */
export function forecastPace(
  overall: BurnRate,
  recent: BurnRate | null,
): BurnRate {
  return hasBurnRate(recent) && recent !== null ? recent : overall;
}
