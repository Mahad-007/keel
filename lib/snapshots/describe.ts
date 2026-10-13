import {
  deliverableStatusLabel,
  type DeliverableStatus,
} from "@/lib/deliverables/status";
import { formatMinutes } from "@/lib/minutes";

import type {
  ScopeChangeField,
  ScopeChangeKind,
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
