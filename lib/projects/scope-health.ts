import type { ScopeHealth } from "@/lib/scope-creep";

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
