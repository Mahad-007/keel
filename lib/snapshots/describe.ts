import {
  deliverableStatusLabel,
  type DeliverableStatus,
} from "@/lib/deliverables/status";
import { formatMinutes } from "@/lib/minutes";
import { deliverablesPhrase } from "@/lib/projects/scope-summary";

import type {
  ScopeChangeField,
  ScopeChangeKind,
  ScopeDiffSummary,
  ScopeFieldChange,
} from "./diff";

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

/**
 * One change to one line, as a sentence.
 *
 * A sentence rather than a before-and-after pair of cells, because three of
 * the four fields need a reading rather than a value: an estimate that went
 * from nothing to two hours is not "0m → 2h", it is a line somebody finally
 * sized, and a table of arrows would leave the reader to work that out four
 * times per row.
 *
 * The estimate's four cases are the ones worth separating. A zero is not an
 * estimate of nothing — it is a missing number, the same rule the scope list
 * and the summary already follow — so a line going from zero reads as being
 * estimated for the first time, and a line going to zero reads as having lost
 * its estimate rather than having shrunk to nothing.
 *
 * A description's text is deliberately not shown. It is a paragraph, and two
 * paragraphs in a table cell are unreadable at exactly the moment a reader is
 * scanning for the hours — what changed is enough to send them to the
 * deliverable itself, which is one click away.
 */
export function describeFieldChange(change: ScopeFieldChange): string {
  switch (change.field) {
    case "title":
      return `Retitled from “${change.before}” to “${change.after}”.`;
    case "estimate":
      if (change.before === 0) {
        return `Estimated at ${formatMinutes(change.after)}, having had no estimate before.`;
      }
      if (change.after === 0) {
        return `Estimate of ${formatMinutes(change.before)} taken off, leaving the line unsized.`;
      }
      return change.after > change.before
        ? `Estimate up from ${formatMinutes(change.before)} to ${formatMinutes(change.after)}.`
        : `Estimate down from ${formatMinutes(change.before)} to ${formatMinutes(change.after)}.`;
    case "status":
      // Both sides are read back out of a TEXT column, so a hand-edited row
      // can hold a fourth value. `deliverableStatusLabel` falls back to the
      // stored string for exactly that case, which is why the cast is safe
      // and why it is better than refusing to describe the row.
      return `Status moved from ${deliverableStatusLabel(change.before as DeliverableStatus)} to ${deliverableStatusLabel(change.after as DeliverableStatus)}.`;
    case "description":
      if (change.before === null) return "Detail added.";
      if (change.after === null) return "Detail taken off.";
      return "Detail reworded.";
  }
}

/**
 * Clauses joined the way a person reads a list: commas, and an "and" before
 * the last of them.
 *
 * Private, because it is not a general utility — it exists so that the counts
 * below read as one sentence rather than three fragments, and the two callers
 * that want it are in this file.
 */
function joinClauses(clauses: readonly string[]): string {
  if (clauses.length <= 1) return clauses[0] ?? "";
  const last = clauses[clauses.length - 1];
  return `${clauses.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * How many lines were added, dropped and changed, in one clause — or null
 * when none of the three happened.
 *
 * The noun goes on the first count only, which is what makes it read as
 * English: "2 deliverables added, 1 dropped and 1 changed" rather than the
 * word repeated three times. It agrees with the count it is attached to, so a
 * single added line reads "1 deliverable added".
 *
 * Unchanged lines are left out. They are the rows a reader skims past, and
 * putting them in this clause would bury the three numbers that matter in a
 * list of four — the count is in the summary for the panel to show beside the
 * table, where it says how much of the list is untouched.
 *
 * Null rather than an empty string, so the caller renders nothing rather than
 * a sentence with a hole in it.
 */
export function describeLineChanges(
  summary: ScopeDiffSummary,
): string | null {
  const counts = [
    { count: summary.addedCount, word: "added" },
    { count: summary.removedCount, word: "dropped" },
    { count: summary.changedCount, word: "changed" },
  ].filter((part) => part.count > 0);

  if (counts.length === 0) return null;

  return joinClauses(
    counts.map((part, index) =>
      index === 0
        ? `${deliverablesPhrase(part.count)} ${part.word}`
        : `${part.count} ${part.word}`,
    ),
  );
}
