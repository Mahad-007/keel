import type { EffectiveRate } from "@/lib/rates";

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
