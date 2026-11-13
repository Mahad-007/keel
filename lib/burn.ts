import { MINUTES_PER_HOUR } from "@/lib/minutes";
import { burnedCents, hasRate, type EffectiveRate } from "@/lib/rates";
import type { LoggedTotals } from "@/lib/time/rollup";

/**
 * What a project has consumed of what it was agreed for.
 *
 * Three numbers meet here for the first time, and until they do none of them
 * answers the question anybody is actually asking. The contract value says
 * what the engagement pays. The time entries say how many minutes went into
 * it. The rate says what a minute is worth. Multiply the last two and subtract
 * from the first, and the result is the only figure that says whether this
 * project is still worth doing — and it is a figure nobody computes by hand,
 * because the three halves of it live in three different tables.
 *
 * It is deliberately not the same question as the scope summary's. That panel
 * compares estimates against each other and says what was *agreed*; the time
 * rollup compares hours against estimates and says what has been *spent* in
 * hours. This is the money: hours valued at the rate they bill at, set against
 * the price that was agreed. A project can be perfectly on its estimates and
 * still have burned its whole contract, because the estimates were optimistic
 * — and that is exactly the case this file exists to make visible.
 *
 * Everything here is pure arithmetic over plain numbers. Minutes and cents,
 * both whole, no row read and no string formatted. The words these figures
 * are read in are `lib/projects/burn-summary.ts`, and the classifier that
 * turns them into a judgement is Day 033's.
 */

/**
 * A project's burn: what it was agreed for, what the hours have come to, and
 * the two readings of the gap between them.
 *
 * The rate travels with the figures rather than being consumed and discarded,
 * because a burn figure cannot be acted on without it. Nought burned is a
 * measurement when a rate is set and an absence when one is not, and those two
 * want opposite things done about them — one is a project nobody has worked
 * on, the other is a form somebody has not filled in. The source says which
 * form.
 *
 * The minutes come along for the same reason the entry count does: the money
 * figure is a product, and a reader who finds it surprising wants to know
 * which half surprised them. "Nine thousand dollars burned" is a different
 * conversation at sixty hours than at six.
 */
export type BurnSummary = {
  /** What the engagement was agreed for, in cents, as the project holds it. */
  readonly contractedCents: number;
  /** The rate the hours were valued at, and which row set it. */
  readonly rate: EffectiveRate;
  /** How many stretches of work the burn was built from. */
  readonly entryCount: number;
  /** Every minute logged against the project. */
  readonly loggedMinutes: number;
  /** The part of those minutes meant to reach an invoice. */
  readonly billableMinutes: number;
  /** What every logged minute comes to at the rate, in cents. */
  readonly burnedCents: number;
  /** What the chargeable part of it comes to, in cents. */
  readonly chargeableCents: number;
  /** Contracted minus burned, in cents. Below zero means it has gone over. */
  readonly remainingCents: number;
  /** Burned over contracted, unrounded and unclamped, or null with no price. */
  readonly consumedShare: number | null;
};

/**
 * What is left of the contract after the hours logged so far, in cents.
 *
 * Contracted minus burned, and it is allowed to go below zero. That is the
 * whole point: a project that has burned more than it was sold for is the
 * thing this phase was built to catch, and clamping the figure at nought
 * would turn the one project that needs attention into the one project that
 * looks finished. "Minus $3,400.00" is a sentence somebody acts on; "$0.00"
 * is a sentence they scroll past.
 *
 * Both figures are whole cents, so the difference is exact and there is no
 * rounding to be careful about — the only arithmetic in this file that is not
 * approximate, which is why the two percentages either side of it are the
 * figures to be suspicious of rather than this one.
 *
 * It takes the two amounts rather than a summary, so the summary can be built
 * out of it rather than having to exist before it does.
 */
export function remainingContractCents(
  contractedCents: number,
  burnedCents: number,
): number {
  return contractedCents - burnedCents;
}

/**
 * How much of the contract the burn has consumed, as a fraction.
 *
 * Unrounded and unclamped, like `deliveredShare` and `loggedShare` before it:
 * the rounding belongs to the formatter, which can say "less than 1%" where
 * this says 0.004, and the bound belongs nowhere at all. A share of 1.68 is a
 * project that has burned two thirds more than it was sold for, and it is the
 * single most useful number in the app — a figure capped at 1.0 would report
 * it as a project that has just finished its budget.
 *
 * Null, not zero, when there is no price to take a share of:
 *
 *   - **No contract value.** Zero cents is what the column defaults to, so it
 *     means "nobody has said" far more often than "agreed at no charge" — the
 *     reading the header and the scope summary already take. Dividing by it
 *     gives infinity, and a project showing "∞% consumed" because somebody
 *     has not filled in a field yet is a page reporting its own gap as the
 *     client's problem.
 *   - **A contract value below zero.** Only a hand-edited row gets there, and
 *     dividing by it flips the sign: an engagement that has burned half its
 *     value would read as minus fifty percent consumed, which is a figure
 *     with no honest reading at all.
 *
 * The same rule, and the same reasoning, as `impliedRateCents` applies to a
 * non-positive estimate. A share that cannot be taken is reported as absent
 * rather than as nought, because nought is a measurement and this is a gap.
 */
export function consumedShare(
  contractedCents: number,
  burnedCents: number,
): number | null {
  if (contractedCents <= 0) return null;
  return burnedCents / contractedCents;
}

/**
 * How far past the contract the burn has gone, in cents, and nought when it
 * has not gone past at all.
 *
 * The same subtraction as `remainingContractCents` with its sign flipped and
 * its floor at nought, which sounds like the clamping that function refuses.
 * It is the opposite: that figure is what is *left*, and a left-over that
 * stopped at nought would hide the overrun. This figure is the *overrun*, and
 * a project still inside its budget has not got one — "minus $3,400.00 over"
 * is not a sentence, and a note that printed it would read as an overrun on a
 * project that is fine.
 *
 * Two functions rather than one with a sign for the reader to interpret,
 * because the two end up in different sentences: a figures column wants the
 * remainder with its sign, and the sentence under it wants the amount to put
 * after the word "over".
 *
 * No opinion about whether a contract value was set. A project with no price
 * and six hours logged comes back as six hours' worth of overspend, which is
 * arithmetically true and useless to say out loud — the words module asks
 * whether there is a price before it asks this.
 */
export function overspentCents(
  contractedCents: number,
  burnedCents: number,
): number {
  return Math.max(0, burnedCents - contractedCents);
}

/**
 * The whole burn for one project: its price, its hours, and its rate.
 *
 * Three arguments from three tables, which is exactly why the comparison is
 * never made by hand. One call, and every figure in the result is consistent
 * with the others by construction — the remainder is the difference of the two
 * amounts above it, and the share is their quotient, so a panel cannot show a
 * remainder worked out from one burn figure and a percentage worked out from
 * another.
 *
 * The rate is handed in already resolved rather than as a project and a
 * client, so there is exactly one place in the app that decides what an hour
 * is worth, and it is `resolveRate`. Taking the two rows here would be a
 * second opinion about what a NULL override means, and the two would drift —
 * the expensive direction of that drift being a project that inherits its
 * client's rate and burns nothing.
 *
 * Both money figures go through `burnedCents`, so the rounding is the
 * arithmetic an invoice line will use. Rounded separately rather than the
 * chargeable half being subtracted from the whole, which costs nothing here —
 * `remainingContractCents` is the figure that has to reconcile, and it is
 * built from the whole burn rather than from the parts.
 *
 * Every minute logged goes into the burn, chargeable or not. Deciding not to
 * charge for an afternoon does not give the afternoon back: the work happened,
 * it cost what it cost, and a fixed-price engagement that writes off a third
 * of its hours has still spent them. The chargeable figure is carried beside
 * it so the write-off can be named, which is the honest way round — a burn
 * figure that quietly dropped the absorbed hours would make a project look
 * healthier the more of its time somebody gave away.
 */
export function summariseBurn(
  totals: LoggedTotals,
  contractedCents: number,
  rate: EffectiveRate,
): BurnSummary {
  const burned = burnedCents(totals.loggedMinutes, rate);

  return {
    contractedCents,
    rate,
    entryCount: totals.entryCount,
    loggedMinutes: totals.loggedMinutes,
    billableMinutes: totals.billableMinutes,
    burnedCents: burned,
    chargeableCents: burnedCents(totals.billableMinutes, rate),
    remainingCents: remainingContractCents(contractedCents, burned),
    consumedShare: consumedShare(contractedCents, burned),
  };
}

/**
 * How much more work the unburned part of the contract pays for, in whole
 * minutes — the inverse of `burnedCents`.
 *
 * Money is what the agreement is in and time is what gets spent, so a
 * remainder in cents is a figure somebody then has to divide in their head
 * before it tells them anything. "$2,000.00 left" is an accounting fact;
 * "13h 20m left at this rate" is a decision about next week.
 *
 * Floored rather than rounded, which is the one place in this file the
 * arithmetic is deliberately pessimistic. The figure is what the budget can
 * still afford, and rounding up offers a minute there is no money for. Half a
 * cent is not worth arguing about; a figure that is never an overstatement is
 * worth having.
 *
 * Null when the rate cannot divide: no rate anywhere, a rate overridden to
 * nothing — which really does buy unlimited hours, and "infinity" is not a
 * figure to print — and a negative rate, where the answer comes back with its
 * sign flipped and means nothing at all. `hasRate` is the same predicate the
 * burn figure asks before it values anything.
 *
 * A remainder at or below zero is divided anyway and answers nought or less.
 * The caller asking "how much longer can we go" has already established there
 * is something left; a project that is over has an overrun to report instead,
 * and that figure is in cents because that is the number somebody has to find.
 */
export function remainingMinutesAtRate(
  remainingCents: number,
  rate: EffectiveRate,
): number | null {
  if (!hasRate(rate)) return null;
  return Math.floor((remainingCents * MINUTES_PER_HOUR) / rate.cents);
}
