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

/**
 * The two readings a verdict is made from, and the two facts needed to know
 * whether they can be trusted.
 *
 * Plain numbers rather than a `BurnSummary` and a list of scope lines, for the
 * reason every pure file here takes the narrowest shape it can: the classifier
 * can then be called with a literal in a test, with a project page's figures,
 * and — Day 039 — with a row out of a portfolio query that never built either
 * of those objects.
 *
 * `consumedShare` is `consumedShare` from `lib/burn.ts` and `deliveredShare`
 * is `deliveredShare` from `lib/scope.ts`, both unrounded, both unclamped,
 * both null where their denominator is missing. Unclamped matters: a share of
 * 1.68 is the input this file was built to act on, and a caller that capped it
 * at one would hand over a project reading as merely finished.
 *
 * `burnValued` is handed in rather than worked out here. `hasValuedBurn` in
 * `lib/projects/burn-summary.ts` is already the one place that decides whether
 * a burn figure is a measurement or a gap, and a second reading of the rate
 * column in this file would be a second opinion — the expensive direction of
 * that drift being a project with eighty unpriced hours classified `healthy`.
 *
 * `scopeDelivered` is `allDelivered` from `lib/scope.ts`: whether every line
 * of the agreed list is done. It is the fact that tells a project finished
 * inside its budget from one halfway through and running out of it, and
 * without it a success looks exactly like a project about to fail.
 */
export type CreepReadings = {
  /** Burn over contract value, unclamped, or null with no price to divide by. */
  readonly consumedShare: number | null;
  /** Delivered estimate over total estimate, or null with nothing estimated. */
  readonly deliveredShare: number | null;
  /** Whether the burn behind the consumed share is a measurement, not a gap. */
  readonly burnValued: boolean;
  /** Whether every line of the agreed scope is marked done. */
  readonly scopeDelivered: boolean;
};

/**
 * The consumed share, once the two readings that look like measurements and
 * are not have been thrown out.
 *
 * `consumedShare` already refuses the prices it cannot divide by. What it
 * cannot refuse is a burn that came out wrong, and there are two of those —
 * both of which arrive as a perfectly well-formed fraction:
 *
 *   - **Hours logged with no rate anywhere.** The burn comes out at nought, so
 *     the share comes out at nought, and nought percent consumed is the single
 *     most reassuring thing this file could say about a project that may have
 *     eaten its budget twice over. It is the one input that would put the
 *     worst-documented project at the top of a healthy list.
 *   - **A rate below zero.** Only a hand-edited row reaches it. The burn is
 *     negative, so the share is negative, and a project that has burned half
 *     its contract reads as minus fifty percent consumed — which classifies
 *     `healthy` and is not a reading of anything.
 *
 * Both come back null, which is the same answer `consumedShare` gives a
 * missing price and means the same thing: there is no share here. Null rather
 * than a verdict, because a classifier that answers `watch` to a missing rate
 * is reporting its own gap as the project's problem.
 */
export function readConsumedShare(readings: CreepReadings): number | null {
  if (!readings.burnValued) return null;
  if (readings.consumedShare === null) return null;
  if (readings.consumedShare < 0) return null;
  return readings.consumedShare;
}

/**
 * The things that can be missing, each named by what would fix it.
 *
 * A verdict is only as good as the two shares behind it, and on a real
 * database at least one of them is often absent. A classifier that said
 * nothing about that would be indistinguishable from one that had looked and
 * found nothing wrong — which is the failure that matters here, because the
 * project with no rate set is exactly the project nobody is watching.
 *
 * Codes rather than sentences. Day 034 writes the words, and it can write
 * different ones for a banner and a portfolio row without this file having an
 * opinion about either. A code is also what a test can assert on without
 * pinning prose.
 *
 * `scope-not-estimated` is the only one of the four that does not stop a
 * verdict being reached. The others each take the money axis away, which is
 * every axis there is.
 */
export const CREEP_BLIND_SPOTS = [
  /** No contract value, so the burn has nothing to be a share of. */
  "no-contract-value",
  /** Hours logged with no rate anywhere, so the burn figure is a gap. */
  "burn-not-valued",
  /** A burn below zero, which only a rate below zero produces. */
  "burn-below-zero",
  /** Nothing estimated, so completion cannot be measured at all. */
  "scope-not-estimated",
] as const;

/** One thing a verdict could not see. */
export type CreepBlindSpot = (typeof CREEP_BLIND_SPOTS)[number];

/**
 * Everything this verdict could not see, in the order a reader would meet it.
 *
 * The money first, because without it there is no verdict at all; the
 * estimates after, because they only cost the second axis.
 *
 * At most one of the three money gaps is reported, and the order is the order
 * of what to do about it. A project with no price and no rate has two fields
 * missing, and listing both would be true and useless — the price is the one
 * that makes the panel empty, and a reader who fills it in will be told about
 * the rate next. A negative burn is only reachable past the other two, so it
 * is reported last of the three.
 *
 * `scope-not-estimated` stacks with any of them, because it is a different
 * form on a different tab. A project with no contract value and no estimates
 * genuinely has two things to fix, and the verdict is missing both axes rather
 * than one.
 *
 * An empty array is the ordinary answer: most projects have a price, a rate
 * and some sized deliverables, and for those the verdict stands on its own.
 */
export function creepBlindSpots(
  readings: CreepReadings,
): readonly CreepBlindSpot[] {
  const spots: CreepBlindSpot[] = [];
  if (readings.consumedShare === null) {
    spots.push("no-contract-value");
  } else if (!readings.burnValued) {
    spots.push("burn-not-valued");
  } else if (readings.consumedShare < 0) {
    spots.push("burn-below-zero");
  }
  if (readings.deliveredShare === null) spots.push("scope-not-estimated");
  return spots;
}

/**
 * The reasons a project is flagged, each naming the comparison that flagged
 * it.
 *
 * A verdict on its own is a coloured dot. "Over" tells somebody to worry;
 * "over, because 60% of the contract has bought 10% of the work" tells them
 * what to do, and tells them which of the two figures to argue with if they
 * think it is wrong. Every non-healthy verdict in this file carries at least
 * one of these, and the reason is what Day 034 turns into its sentence.
 *
 * Codes rather than sentences, for the reason the blind spots are: the words
 * belong to whatever is reading them, and a code is what a test can assert on
 * without pinning prose that will be rewritten.
 *
 * Four, which is the two axes at their two thresholds each. They are not
 * mutually exclusive — a project can be past its contract *and* have run a
 * long way ahead of its delivery, and those are two separate things to say.
 */
export const CREEP_REASONS = [
  /** The burn has reached or passed the contract value. */
  "contract-overspent",
  /** The burn has run half the contract ahead of the delivered work. */
  "burn-far-ahead-of-delivery",
  /** The burn has reached four fifths of the contract. */
  "contract-nearly-spent",
  /** The burn has run a quarter of the contract ahead of the work. */
  "burn-ahead-of-delivery",
] as const;

/** One comparison that flagged a project. */
export type CreepReason = (typeof CREEP_REASONS)[number];

/**
 * Every comparison that flagged this project, worst first.
 *
 * Worst first rather than axis by axis, because the first reason is the
 * headline: Day 034's banner leads with it, and a reader who stops after one
 * sentence should have been told the worst thing. The rest follow in the same
 * order for the same reason.
 *
 * The gap is taken from the consumed share this function has already read
 * rather than from the one in the readings, so the two axes agree about what
 * the burn was: a share thrown out as unreadable cannot come back in through
 * the subtraction and flag a project on a figure the money axis refused.
 *
 * Both axes are read through the same thresholds the two classifiers use, so a
 * verdict and the reasons under it can never disagree — `classifyScopeCreep`
 * is built out of this function rather than beside it, which is what makes
 * that guarantee structural rather than a thing to test for.
 *
 * A project with every line of its scope delivered is not flagged for nearing
 * its contract. Four fifths of the price spent on all of the work is the shape
 * of a job well done, and the fifth left over is profit rather than runway —
 * flagging it would put a success in the same list as the engagements that are
 * failing. Being *over* is not excused the same way: the money is gone and it
 * is not coming back, and that is the figure to carry into the next quote for
 * this client. An empty scope list is not delivered, so an unscoped project
 * nearing its contract is still flagged, which is right — nobody can say what
 * the remaining fifth has to cover.
 *
 * Empty when there is nothing to flag, which covers both a project going well
 * and one that cannot be read at all. Those two are told apart by
 * `creepBlindSpots`, not by this: a reason is a comparison that came out
 * badly, and a comparison nobody could make did not come out at all.
 */
export function creepReasons(
  readings: CreepReadings,
): readonly CreepReason[] {
  const consumed = readConsumedShare(readings);
  if (consumed === null) return [];

  const reasons: CreepReason[] = [];
  const money = classifyConsumedShare(consumed);
  const creep = classifyCreepGap(creepGap(consumed, readings.deliveredShare));

  if (money === "over") reasons.push("contract-overspent");
  if (creep === "over") reasons.push("burn-far-ahead-of-delivery");
  if (money === "watch" && !readings.scopeDelivered) {
    reasons.push("contract-nearly-spent");
  }
  if (creep === "watch") reasons.push("burn-ahead-of-delivery");
  return reasons;
}

/**
 * What each reason says about a project on its own.
 *
 * The bridge between the reasons and the verdict. Having it written down once
 * means the verdict is *derived* from the reasons rather than worked out
 * alongside them: a project cannot come back `over` with nothing to show for
 * it, and a reason cannot be reported under a verdict that does not account
 * for it. The two could not be made to disagree without editing this record.
 *
 * A record over every reason rather than a pair of lists, so a fifth reason
 * added later is a compile error here — the one place that has to have an
 * opinion about how bad it is — rather than a reason that quietly classifies
 * as `healthy` and shows up in a banner under the word "Healthy".
 *
 * No reason maps to `healthy`. A reason is a comparison that came out badly,
 * and one that came out well is not reported at all.
 */
export const REASON_HEALTH: Record<CreepReason, ScopeHealth> = {
  "contract-overspent": "over",
  "burn-far-ahead-of-delivery": "over",
  "contract-nearly-spent": "watch",
  "burn-ahead-of-delivery": "watch",
};
