import {
  deliverableStatusLabel,
  type DeliverableStatus,
} from "@/lib/deliverables/status";
import { formatMinutes } from "@/lib/minutes";
import {
  deliverablesPhrase,
  hoursPhrase,
} from "@/lib/projects/scope-summary";
import { formatCents } from "@/lib/money";
import { estimatedHours } from "@/lib/scope";

import { describeEstimate } from "@/lib/deliverables/list";

import type {
  ScopeChangeKind,
  ScopeDiffEntry,
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

/**
 * Whether one side's total of zero means what the sentence below takes it to
 * mean: a scope list nobody had sized.
 *
 * A total of nought minutes has two causes and they read nothing alike. One is
 * a list with no estimates on it, which is the reading every "nothing was
 * estimated" sentence in this file depends on. The other is a hand-edited
 * negative line cancelling a positive one — two deliverables sized at minus
 * two hours and plus two — where the list is estimated, the total is simply
 * not the sum of the work.
 *
 * Asked per side, because the sides are two lists at two moments: a bad row
 * can be captured and fixed since, or written since. Where it is true, the
 * figures go back to being plain arithmetic and the sentence above them says
 * so — the same division the scope panel makes between its figures and
 * `describeEstimateProblem`.
 */
function sideIsUnsized(minutes: number, negativeCount: number): boolean {
  return minutes === 0 && negativeCount === 0;
}

/**
 * What the scope list's estimate did, as a sentence.
 *
 * The movement and both ends of it, because a movement on its own is not a
 * fact a reader can act on: six hours added to an estimate of eight is a
 * different conversation from six added to eight hundred, and a sentence that
 * reported only the delta would send them off to find the denominator.
 *
 * Hours rather than `8h 30m`, because this is a sentence and the estimate was
 * agreed in hours — "forty hours" is what somebody said out loud. The figures
 * come through `estimatedHours`, so the panel's reading and the summary's
 * rounding are the same rounding.
 *
 * The two ends where nothing was estimated get their own sentences. "Up 8
 * hours, from 0 hours to 8 hours" describes an estimate that grew, where what
 * actually happened is that a list nobody had sized has been sized — and the
 * same at the other end, where the figure did not shrink to nothing, it went
 * missing. The same rule the scope list follows for a single line: a zero is a
 * number nobody supplied.
 */
export function describeEstimateMovement(summary: ScopeDiffSummary): string {
  const before = hoursPhrase(estimatedHours(summary.estimatedMinutesBefore));
  const after = hoursPhrase(estimatedHours(summary.estimatedMinutesAfter));
  const beforeUnsized = sideIsUnsized(
    summary.estimatedMinutesBefore,
    summary.negativeEstimateCountBefore,
  );
  const afterUnsized = sideIsUnsized(
    summary.estimatedMinutesAfter,
    summary.negativeEstimateCountAfter,
  );

  /*
    Asked before the delta, because a delta of zero between two zeroes is not
    an estimate that held steady — it is a scope list nobody has sized, on
    either side. "Unchanged, at 0 hours" would state the figure as a fact,
    which is the one reading this file exists to prevent.
  */
  if (beforeUnsized && afterUnsized) {
    return "Nothing was estimated when the snapshot was taken, and nothing is estimated now.";
  }
  if (summary.estimatedMinutesDelta === 0) {
    return `The estimate is unchanged, at ${after}.`;
  }
  if (beforeUnsized) {
    return `Nothing was estimated when the snapshot was taken; the scope list now comes to ${after}.`;
  }
  if (afterUnsized) {
    return `Nothing is estimated now, where the snapshot came to ${before}.`;
  }

  const moved = hoursPhrase(Math.abs(summary.estimatedHoursDelta));
  const direction = summary.estimatedMinutesDelta > 0 ? "up" : "down";
  return `The estimate is ${direction} ${moved}, from ${before} to ${after}.`;
}

/**
 * What the price did, as a sentence.
 *
 * Said even when it did not move, which is the whole reason the snapshot
 * records it. "Six hours of extra scope" is not a complaint on its own —
 * engagements grow — and it only becomes one when the sentence after it says
 * the contract value is unchanged. A panel that mentioned the price only when
 * it had changed would leave its silence to be interpreted.
 *
 * The movement and where it landed, rather than both ends. The amounts are
 * long enough that three of them in one sentence stops being readable, and
 * what was agreed before is one line up in the heading of the comparison.
 */
export function describeContractMovement(summary: ScopeDiffSummary): string {
  const now = formatCents(summary.contractValueCentsAfter);

  if (summary.contractValueCentsDelta === 0) {
    return `The contract value is unchanged, at ${now}.`;
  }

  const moved = formatCents(Math.abs(summary.contractValueCentsDelta));
  const direction = summary.contractValueCentsDelta > 0 ? "up" : "down";
  return `The contract value is ${direction} ${moved}, to ${now}.`;
}

/**
 * What to say when the scope list still reads exactly as it was captured.
 *
 * It names the three things it is claiming are the same, because "nothing has
 * changed" is a claim a reader has to be able to check. A project that has
 * grown by two deliverables and shrunk by two would be an unpleasant surprise
 * under a bare "nothing changed", and this sentence says which comparison was
 * actually made.
 */
export const SCOPE_UNCHANGED_SINCE =
  "Nothing has changed since this snapshot — the same deliverables, estimated the same, at the same contract value.";

/**
 * What the whole comparison amounts to, in a short paragraph.
 *
 * Three sentences at most, in the order a reader needs them: how many lines
 * moved, what that did to the estimate, and what the price did about it. The
 * third is the one that turns the first two into a conversation, which is why
 * it is said whether or not the amount moved.
 *
 * The lines clause is dropped when no line moved, rather than rendered as "0
 * deliverables added": a project whose scope is untouched and whose price has
 * changed is a real thing to have happened, and it reads better as two
 * sentences than as three with a zero in one of them.
 *
 * One string rather than a list of sentences, because that is what the panel
 * renders — a paragraph. The individual sentences are exported above for the
 * tests that hold each of them to its own rules.
 */
export function describeScopeDiff(summary: ScopeDiffSummary): string {
  if (!summary.hasChanges) return SCOPE_UNCHANGED_SINCE;

  const lineChanges = describeLineChanges(summary);
  const sentences = [
    lineChanges === null ? null : `Since this snapshot: ${lineChanges}.`,
    describeEstimateMovement(summary),
    describeContractMovement(summary),
  ].filter((sentence): sentence is string => sentence !== null);

  return sentences.join(" ");
}

/**
 * How many lines are exactly as they were agreed, or null when none are.
 *
 * The table lists only the rows that moved, so this is the sentence that says
 * what is not in it. Without it a reader has no way to tell a comparison of
 * three changes on a list of twelve from a comparison of three on a list of
 * three, and the difference is most of what the page is for.
 *
 * It says "exactly" on purpose. These are lines whose title, estimate, status
 * and detail all read as they did, which is a stronger claim than "not
 * changed" and the one the comparison is actually making.
 */
export function describeUnchangedLines(
  summary: ScopeDiffSummary,
): string | null {
  if (summary.unchangedCount === 0) return null;
  return summary.unchangedCount === 1
    ? "One other deliverable is exactly as it was agreed, and is not listed."
    : `${summary.unchangedCount} other deliverables are exactly as they were agreed, and are not listed.`;
}

/**
 * What to call one row of the comparison.
 *
 * The current title where there is one, because that is what the reader will
 * find in the scope list above — a retitled line is named by what it is called
 * now, and the sentence beside it says what it used to be. A dropped line has
 * only the snapshot's title, which is the whole reason the snapshot keeps it.
 *
 * The empty fallback is unreachable: every entry has at least one side. It is
 * here because the entry shape is flat on purpose, and a row rendering
 * `undefined` would be a worse way to discover that than an empty cell.
 */
export function diffEntryTitle(entry: ScopeDiffEntry): string {
  return entry.after?.title ?? entry.before?.title ?? "";
}

/**
 * The estimate to show against one row.
 *
 * The current one, except for a dropped line, where the only estimate that
 * exists is the one the snapshot recorded — and it is the number that matters
 * most on that row, because it is what the project is no longer being paid to
 * do. A line whose estimate moved shows where it is now; the sentence beside
 * it carries both ends.
 *
 * Through `describeEstimate`, so an unsized line reads "Not estimated" here
 * exactly as it does in the scope list rather than as `0m`.
 */
export function diffEntryEstimate(entry: ScopeDiffEntry): string {
  const line = entry.kind === "removed" ? entry.before : entry.after;
  return line === null ? "" : describeEstimate(line.estimatedMinutes);
}

/**
 * What to say about one row, as the sentences it is made of.
 *
 * A list rather than one string, because a changed line can have four things
 * to say about it and they are read as a list on screen rather than as a
 * paragraph in a cell.
 *
 * Added and dropped lines get a sentence each, where a table of arrows would
 * leave the kind column to carry the whole meaning. Both say where the line is
 * *not*, which is the fact a reader is checking: an added line is one the
 * snapshot never had, and a dropped one is no longer anything the project owes.
 */
export function describeDiffEntry(entry: ScopeDiffEntry): string[] {
  switch (entry.kind) {
    case "added":
      return ["Not in this snapshot — agreed after it was taken."];
    case "removed":
      return ["No longer in the scope list."];
    case "changed":
      return entry.changes.map(describeFieldChange);
    case "unchanged":
      return [];
  }
}
