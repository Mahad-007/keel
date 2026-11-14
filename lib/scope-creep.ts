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

/**
 * How bad a verdict is, as a number to compare.
 *
 * The position in `SCOPE_HEALTH`, so the one place the order is written down
 * is the array that declares the states. A record mapping each state to a
 * figure would be a second statement of the same order, and the two would be
 * free to disagree.
 *
 * Exported because a ranking is the obvious thing to want from a classifier —
 * a portfolio sorted worst-first is the whole point of having one — and
 * because the combination rule below needs it. Nothing reads the figure
 * itself: it has no units and no meaning beyond being larger for worse.
 */
export function healthSeverity(health: ScopeHealth): number {
  return SCOPE_HEALTH.indexOf(health);
}

/**
 * The worse of two verdicts.
 *
 * A project is assessed on two axes — the money and the work — and a verdict
 * has to be one word, so the two readings have to combine. The worse of them
 * wins, which is the only combination that cannot hide a problem: averaging
 * them would let a project burning its budget with nothing delivered come out
 * as `watch` because one of the two figures was fine, and a project with one
 * thing badly wrong is a project with one thing badly wrong.
 *
 * Associative and commutative, so a third axis can be folded in later without
 * the order of the folding changing the answer.
 */
export function worstHealth(a: ScopeHealth, b: ScopeHealth): ScopeHealth {
  return healthSeverity(b) > healthSeverity(a) ? b : a;
}

/**
 * The share of the contract at which a project stops being comfortable.
 *
 * Four fifths. Not a figure anybody can derive: it is the point at which the
 * remaining fifth stops being a buffer and starts being the thing that has to
 * cover whatever is left of the work, and that is a judgement about how
 * engagements go rather than a fact about arithmetic.
 *
 * Chosen high rather than low on purpose. A threshold that fires at half the
 * budget fires on every project in its second week, and a flag that is always
 * on is a flag nobody reads — the cost of a false alarm here is not the alarm,
 * it is every real one after it being ignored. Four fifths is late enough to
 * mean something and early enough that a fifth of the money is still there to
 * do something with.
 *
 * Day 038 makes this per-client and per-project, because a retainer and a
 * fixed-price build do not have the same tolerance. Until then it is one
 * number for every engagement, which is wrong in the way a default is wrong
 * rather than in the way a bug is.
 */
export const NEARLY_SPENT_SHARE = 0.8;

/**
 * The share of the contract at which a project is over it.
 *
 * One. The whole price, spent. There is no judgement in this figure and no
 * threshold to tune — it is the definition of being over, and Day 038 will
 * leave it alone when it makes the other three configurable.
 *
 * Named all the same, so the comparison below reads as the rule it is rather
 * than as a bare `>= 1` a later reader has to decode.
 */
export const OVERSPENT_SHARE = 1;
