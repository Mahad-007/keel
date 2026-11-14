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

/**
 * What the money alone says about a project.
 *
 * The first of the two axes, and the one that needs no estimates: a contract
 * value and some logged hours are enough. Over the whole price is `over`, four
 * fifths of it is `watch`, anything under that is `healthy`.
 *
 * Inclusive at both thresholds. A project that has burned exactly its contract
 * value is over it — the next hour is unpaid, which is the thing `over` means
 * — and `>=` rather than `>` is what keeps the common case from falling
 * through: round contracts meet round rates, and landing precisely on the
 * price happens far more often than the arithmetic suggests.
 *
 * It takes the share rather than the two amounts, so there is exactly one
 * division in the codebase and it is `consumedShare`'s. The share it is handed
 * has already decided what an unreadable price means, which is why there is no
 * null branch here: a share that arrives is a share worth classifying.
 *
 * No opinion about whether the work is done — that is the other axis, and
 * `creepReasons` is where the two meet. A project that has delivered
 * everything for four fifths of the price is a success, and this function
 * still calls it `watch`, because on the money alone it is.
 */
export function classifyConsumedShare(consumedShare: number): ScopeHealth {
  if (consumedShare >= OVERSPENT_SHARE) return "over";
  if (consumedShare >= NEARLY_SPENT_SHARE) return "watch";
  return "healthy";
}

/**
 * How far the burn has run ahead of the delivery, as a fraction of one.
 *
 * The second axis, and the one this file exists for. Two shares of the same
 * project, subtracted: how much of the money is gone, less how much of the
 * work is done. Nought means the two are in step — half the budget for half
 * the deliverables, which is what a project on track looks like. A fifth means
 * a fifth of the contract has bought nothing yet.
 *
 * Signed, and the sign is not symmetric in meaning. Positive is the money
 * running ahead of the work, which is the failure mode; negative is the work
 * running ahead of the money, which is a project being delivered under budget
 * and needs no attention at all. Both come out of the same subtraction, and
 * only one of them is read.
 *
 * A difference of two shares rather than a ratio of them. The ratio is the
 * tempting figure — "twice as much money as work" — but it divides by a
 * delivered share that is nought for the whole first stretch of every project,
 * which is exactly the stretch this is meant to be read in. The difference is
 * defined everywhere the two shares are, and it stays readable at the start.
 *
 * Null when either share is missing, because there is no half of this figure
 * worth having: without a price there is nothing to say the money has run
 * ahead of, and without estimates there is nothing to say it has run ahead
 * *of*. The missing half is named by `creepBlindSpots` rather than guessed at
 * here.
 */
export function creepGap(
  consumedShare: number | null,
  deliveredShare: number | null,
): number | null {
  if (consumedShare === null || deliveredShare === null) return null;
  return consumedShare - deliveredShare;
}

/**
 * The gap between money and work at which a project is worth another look.
 *
 * A quarter of the contract spent on nothing anybody can point at. Smaller
 * than that is the ordinary shape of a project: the first week buys
 * discovery, a kickoff and a half-built thing, and none of it is a deliverable
 * marked done — so a gap of a tenth is how every engagement starts, and a
 * threshold there would flag all of them.
 *
 * A quarter is also roughly where the gap stops being recoverable by working
 * faster and starts needing a conversation about scope. That is the judgement
 * in the figure, and it is the reason this is `watch` rather than `over`: a
 * quarter out at the halfway mark is a project to look at next week, not one
 * to reprice.
 */
export const AHEAD_OF_DELIVERY_GAP = 0.25;

/**
 * The gap at which the project will not come in, whatever is still in the
 * bank.
 *
 * Half the contract spent on work nobody has delivered. At that point the
 * remaining budget has to cover more than half the deliverables — and the
 * evidence so far is that half the budget bought less than half of them, so
 * the figures have already said it cannot.
 *
 * This is the threshold that makes the file worth writing. It fires on
 * projects with money left, nothing overdue and no invoice yet in dispute:
 * sixty percent consumed against ten percent delivered is `over` here while
 * the contract axis alone still reads `healthy`. Calling it `over` before the
 * money runs out is the entire wedge, and it is the one verdict in this file
 * that a reader would not have reached on their own.
 *
 * The word is right even though nothing has technically been exceeded yet.
 * `over` is the verdict that says this engagement will cost more than it
 * pays, and a project half-spent with a tenth delivered has already settled
 * that question — waiting for the arithmetic to catch up only costs the
 * remaining half.
 */
export const FAR_AHEAD_OF_DELIVERY_GAP = 0.5;

/**
 * What the two shares together say about a project.
 *
 * The second axis, classified the same way as the first: two thresholds,
 * inclusive, worst first. Half the contract ahead of the delivery is `over`,
 * a quarter is `watch`, anything less is `healthy`.
 *
 * `healthy` for a null gap, not a null verdict. A missing gap is a project
 * whose estimates or price cannot be read, and this axis then has no opinion —
 * but "no opinion" has to combine with the other axis as the neutral element,
 * or an unestimated project would drag its own money reading down with it. The
 * fact that the gap could not be read is reported by `creepBlindSpots`, where
 * a reader can act on it; it is not smuggled into the verdict as a worry.
 *
 * A gap below zero is `healthy` and says nothing further. It is a project
 * delivering ahead of its burn, which is a project going well — and the one
 * number that would make it look otherwise is its distance from nought, which
 * is why the comparison is signed rather than absolute.
 */
export function classifyCreepGap(gap: number | null): ScopeHealth {
  if (gap === null) return "healthy";
  if (gap >= FAR_AHEAD_OF_DELIVERY_GAP) return "over";
  if (gap >= AHEAD_OF_DELIVERY_GAP) return "watch";
  return "healthy";
}
