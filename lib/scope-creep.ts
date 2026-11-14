/**
 * Whether a project is in trouble, and on what evidence.
 *
 * Three files have each said half of it. `lib/scope.ts` compares the agreed
 * list against the price and says what the engagement implies per hour.
 * `lib/time/rollup.ts` compares logged hours against the estimates and says
 * what has been spent. `lib/burn.ts` values those hours and sets them against
 * the contract. Every one of those is a measurement, and not one of them is a
 * judgement — a reader still has to hold two percentages in their head and
 * decide what the pair of them means.
 *
 * This is the file that decides. Two readings go in: how much of the contract
 * the burn has eaten, and how much of the estimated work is done. One verdict
 * comes out — `healthy`, `watch`, `over` — with the reasons it was reached,
 * because a verdict nobody can check is a coloured dot.
 *
 * The case it exists for is the one neither percentage catches alone: **high
 * burn against low completion.** Sixty percent of the money for ten percent of
 * the work is a project that will miss by a mile, and on the day it happens
 * there is still forty percent of the budget in the bank and nothing overdue.
 * Both figures look survivable; together they are the end of the engagement's
 * margin. Catching that while the money is still there is the entire wedge.
 *
 * Pure arithmetic over plain numbers, like the three files above it. Nothing
 * here reads a row, formats a figure, or writes a sentence — Day 034's banner
 * turns these verdicts into words, and it can do that because the rule that
 * produced them is testable and this is where it lives.
 */

/**
 * The three verdicts, worst last.
 *
 * The order is load-bearing: `healthSeverity` reads it, so the array is the
 * one statement of which verdict outranks which, and a fourth state inserted
 * in the wrong place would be a project ranked wrongly rather than a type
 * error.
 *
 * Three rather than four. "Unknown" is tempting — plenty of projects cannot be
 * assessed at all — but it is not a verdict about the work, it is an absence
 * of one, and a classifier that returns it has to be read as if it had an
 * opinion. The absence is `null` instead, the way every share in this codebase
 * reports a denominator it does not have.
 *
 * `watch` rather than `warning` or `at risk`. It says what to do about it:
 * nothing yet, but look again next week. A project in this state does not need
 * a conversation with the client, which is what the other two words imply.
 */
export const SCOPE_HEALTH = ["healthy", "watch", "over"] as const;

/**
 * One of the three verdicts.
 *
 * Derived from the array rather than written out again, so the states and
 * their order can never disagree.
 */
export type ScopeHealth = (typeof SCOPE_HEALTH)[number];
