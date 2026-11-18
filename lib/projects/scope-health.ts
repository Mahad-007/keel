import type { ScopeHealth } from "@/lib/scope-creep";

import { formatSharePercent } from "./scope-summary";

/**
 * The words a scope verdict is read in.
 *
 * `lib/scope-creep.ts` decides whether a project is in trouble and returns
 * codes: a verdict, the comparisons that reached it, the things it could not
 * see. Nothing in it knows a word of English, deliberately — a portfolio row
 * and a banner want different lengths of the same news, and a classifier with
 * an opinion about prose would have to be edited to add the second one.
 *
 * This is the banner's half. It turns each code into a sentence that names the
 * comparison and quotes the figures it came out of, because the whole point of
 * the exercise is that a reader can check the claim: "over" tells somebody to
 * worry, and "60% of the contract has paid for 10% of the estimated work"
 * tells them what to do about it — and which of the two figures to argue with
 * if they think it is wrong.
 *
 * No coloured dot, and no bar. A dot is a verdict nobody can check: it says
 * the project is amber and leaves the reader to guess which of the two axes
 * went wrong, how far, and whether anything was measurable at all. The
 * sentences here are longer than a dot on purpose — they are the shortest
 * thing that is actually actionable.
 */

/**
 * What each verdict is called, in words that say what is wrong rather than
 * what colour it is.
 *
 * "Worth watching" rather than "At risk", because the watch threshold is four
 * fifths of a contract or a quarter of it ahead of the delivery — both of
 * which are ordinary mid-engagement readings on a project that will land fine.
 * The word has to carry "look at this" without carrying "this has failed",
 * because a reader who finds the stronger reading overstated once stops
 * believing the banner.
 *
 * "Over scope" rather than "Over budget". Half of what earns it is the money
 * axis, and the other half is the burn running ahead of the delivered work on
 * a project with budget still in the bank — which is not over budget yet and
 * is the case this whole phase was built to catch.
 *
 * A record over every verdict rather than a chain of conditions, so a fourth
 * one added later is a compile error here rather than a banner with no
 * heading.
 */
export const SCOPE_HEALTH_HEADLINE: Record<ScopeHealth, string> = {
  healthy: "On track",
  watch: "Worth watching",
  over: "Over scope",
};

/**
 * What the banner is called when the classifier withheld a verdict.
 *
 * Not "Unknown", which reads as a fault in the page. The verdict is missing
 * because a field is, and the heading should say that much before the sentence
 * under it names the field — a reader who has been told the project cannot be
 * assessed goes looking for the reason, where one told it is unknown goes
 * looking for a bug.
 */
export const NOT_ASSESSED_HEADLINE = "Not assessed";

/**
 * The heading over the banner: the verdict, or the fact that there is none.
 *
 * Takes the verdict rather than the whole assessment, because that is all it
 * reads, and the null is the case a caller most needs to be unable to forget.
 */
export function scopeHealthHeadline(health: ScopeHealth | null): string {
  if (health === null) return NOT_ASSESSED_HEADLINE;
  return SCOPE_HEALTH_HEADLINE[health];
}

/**
 * A gap between two shares, in percentage points.
 *
 * The creep gap is a difference of two fractions, and "0.5" is not a thing to
 * say out loud. Nor is "50%", which is the mistake this function exists to
 * stop: the two shares either side of it are already printed as percentages,
 * and a third percentage between them would read as a share of something —
 * a reader would take "50%" for half the contract rather than the distance
 * between 60% and 10%.
 *
 * Whole points, because both shares behind it are rounded to whole percent
 * where they are printed, and a gap carrying a decimal would not reconcile
 * with the two figures a reader subtracts in their head.
 *
 * A gap that rounds away is written as less than a point rather than as none.
 * It is not reachable from the thresholds the classifier flags on — a quarter
 * of a contract is the narrowest gap that earns a sentence — but a figure
 * function that answers "0 points ahead" to a gap that exists is one a later
 * caller discovers the hard way, and the portfolio ranking in Day 039 will
 * print gaps nobody flagged.
 */
export function formatSharePoints(gap: number): string {
  const points = Math.round(gap * 100);
  if (points === 0 && gap > 0) return "less than a point";
  if (points === 1) return "1 point";
  return `${points} points`;
}

/**
 * Why a project past its contract value is flagged.
 *
 * The plainest sentence in the banner, and the one that needs the least
 * explaining: the money agreed is gone, and the share says by how much. It
 * leads with the figure because the figure is the news — a reader who sees
 * "112%" has already understood the sentence.
 *
 * The second half is the consequence rather than a restatement of the first,
 * because the consequence is what there is to decide. Hours logged from here
 * are hours nobody is paying for, and somebody has to choose whether to keep
 * logging them, raise a change order, or stop — which is a different kind of
 * sentence from "the budget is spent".
 *
 * `formatSharePercent` rather than a percentage worked out here, so the share
 * in this sentence and the share in the burn panel's own Consumed row round
 * the same way. The two sit an inch apart on the overview tab, and two
 * roundings of one fraction is the fastest way to make a reader distrust both.
 */
export function describeOverspentContract(consumedShare: number): string {
  return `The hours logged against this project have burned ${formatSharePercent(
    consumedShare,
  )} of the contract value. Anything logged from here is work the agreement does not pay for.`;
}

/**
 * Why a project nearing its contract value is flagged.
 *
 * The weaker of the two money sentences, and the one most at risk of being
 * read as the stronger. Four fifths of a contract spent is a perfectly
 * ordinary reading on a project four fifths of the way through its work — so
 * the sentence has to say why it is here at all, and the answer is the scope
 * list: the classifier only raises this while there is work outstanding.
 *
 * It closes on what the remainder has to cover rather than on the remainder
 * itself. The amount left is already on the burn panel an inch below, and a
 * banner that repeated it would be the same figure twice with nothing added;
 * what is not anywhere else is that the fraction left has a job, and whether
 * it is enough is the judgement the reader is being asked to make.
 */
export function describeNearlySpentContract(consumedShare: number): string {
  return `The hours logged against this project have burned ${formatSharePercent(
    consumedShare,
  )} of the contract value, and the scope list is not finished. What is left has to cover everything still outstanding.`;
}

/**
 * The two shares, side by side, as the clause both creep sentences open on.
 *
 * This is the comparison the whole phase exists for, in eleven words: what
 * fraction of the money has gone, and what fraction of the work has landed for
 * it. Neither figure flags anything on its own — 60% consumed is a project
 * going fine and 10% delivered is a project that has just started — and set
 * against each other they are an engagement that will miss by a mile.
 *
 * "Has gone on" rather than "has paid for". Nothing has been paid: the burn is
 * hours valued at a rate, and the burn panel says so under its own figures. The
 * contract has been *consumed*, which is a different claim and the one the
 * arithmetic supports.
 *
 * Shared by both gap sentences rather than written twice, so the watch reading
 * and the over reading quote their figures identically and differ only in what
 * they say follows. Two spellings of one comparison is how a reader comes to
 * think the thresholds measure different things.
 */
export function describeBurnAgainstDelivery(
  consumedShare: number,
  deliveredShare: number,
): string {
  return `${formatSharePercent(consumedShare)} of the contract has gone on ${formatSharePercent(
    deliveredShare,
  )} of the estimated work`;
}
