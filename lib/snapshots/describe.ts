import type { ScopeChangeField, ScopeChangeKind } from "./diff";

/**
 * The words a scope comparison is read in.
 *
 * `diff.ts` works out what changed; nothing in it knows what a change is
 * called or how to say it in a sentence. That is this file — the same division
 * as `lib/scope.ts` and `lib/projects/scope-summary.ts`, and for the same
 * reason: deciding that a line whose estimate went from nothing to two hours
 * reads as "estimated at 2h" rather than "estimate up from 0m" is a rule about
 * the data, and a rule is testable where JSX is not.
 *
 * Plain language throughout, and no jargon from the implementation. A reader
 * on this page is often about to forward what it says to a client, so it says
 * "Dropped" rather than "removed", "Detail" rather than "description", and it
 * never says "diff".
 */

/**
 * What each kind of row is called in the table.
 *
 * A record rather than a capitalisation of the kind, so the words can move
 * without the comparison having to — and so a kind added to `diff.ts` without
 * a word for it fails to compile.
 *
 * "Dropped" rather than "Removed", because removed invites the question
 * "removed by whom" where dropped describes the line's fate, which is all the
 * comparison knows. "Unchanged" is the plainest of the four and the one that
 * has to be unmistakable: it is the row a reader skims past.
 */
export const SCOPE_CHANGE_LABELS: Record<ScopeChangeKind, string> = {
  added: "Added",
  removed: "Dropped",
  changed: "Changed",
  unchanged: "Unchanged",
};

/**
 * What each field is called when a change to it is listed.
 *
 * "Detail" rather than "Description", because that is what the deliverable
 * form calls the box. "Estimate" rather than "Estimated minutes": the minutes
 * are the unit, not the name of the thing.
 */
export const SCOPE_CHANGE_FIELD_LABELS: Record<ScopeChangeField, string> = {
  title: "Title",
  estimate: "Estimate",
  status: "Status",
  description: "Detail",
};
