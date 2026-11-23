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
