import type { BurnSummary } from "@/lib/burn";

/**
 * The words a burn summary is read in.
 *
 * `lib/burn.ts` works out what a project has consumed of what it was agreed
 * for; nothing in it knows what a figure is called, when a figure is worth
 * showing, or what a reader should conclude from it. That is this file: a
 * label, a value, and — where the number alone would mislead — the sentence
 * that says how to read it.
 *
 * The sentences live here rather than in the panel for the reason the scope
 * summary's and the rollup's do: deciding that nought burned against eighty
 * hours logged means a missing rate rather than a cheap project is a rule
 * about the data, and a rule is testable where JSX is not.
 *
 * This is the most consequential panel in the app so far. "You have burned
 * 112% of this contract" is a sentence somebody takes into a difficult
 * conversation, and the figure behind it is a product of three columns any
 * one of which may be empty. So every value here either says something the
 * arithmetic supports or says plainly that it cannot — and the note under it
 * is the working, so a reader can check the claim rather than having to
 * believe it.
 */

/**
 * Whether there is a burn worth showing at all.
 *
 * Two ways to have one. Time logged is the obvious one: hours have gone in,
 * and what they came to is the question. A contract value with nothing logged
 * is the other, and it is worth a panel too — "nothing burned, the whole
 * $5,000.00 still there" is the opening state of every engagement, and a
 * panel that appeared only once somebody had logged against it would leave a
 * reader wondering where the figure went.
 *
 * Neither means nothing to say. A project with no price and no hours is a row
 * somebody has just created, and four figures reading "Not set" and "None
 * yet" above it would be a panel reporting that the project is new.
 *
 * Here rather than in the panel, for the reason the sentences are: it is a
 * fact about the burn rather than about one tab, and the panel's most
 * consequential decision — render nothing at all — is testable where JSX is
 * not.
 */
export function hasBurnToShow(summary: BurnSummary): boolean {
  return summary.entryCount > 0 || summary.contractedCents !== 0;
}
