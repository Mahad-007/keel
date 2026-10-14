import {
  INITIAL_TAKE_SNAPSHOT_STATE,
  SNAPSHOT_PROBLEMS,
} from "@/lib/snapshots/form";
import type { ScopeDiff } from "@/lib/snapshots/diff";
import type { SummarisedSnapshot } from "@/lib/snapshots/summary";

import { ScopeComparison } from "./scope-comparison";
import { SnapshotPicker } from "./snapshot-picker";
import { TakeSnapshotForm } from "./take-snapshot-form";

/**
 * One snapshot and what it is being compared against. Null together, because
 * a comparison needs both and a project with no snapshots has neither.
 */
export type ScopeComparisonView = {
  readonly snapshot: SummarisedSnapshot;
  readonly diff: ScopeDiff;
};

/**
 * The snapshot controls, at the foot of the scope tab.
 *
 * The comparison comes first and the button to take a new snapshot last, which
 * is the order of likelihood: a snapshot is taken once at signing and perhaps
 * twice more, where "what has changed since" is the question every visit after
 * that. A reader who has come to settle an argument should not have to scroll
 * past a form to find the answer.
 *
 * Below the templates, because this is the last thing on the tab a reader
 * needs and the one that refers to everything above it.
 */
export function SnapshotSection({
  projectId,
  snapshots,
  comparison,
  scopeIsEmpty,
  take,
}: {
  projectId: string;
  /** Every snapshot of this project, newest first, for the picker. */
  snapshots: readonly SummarisedSnapshot[];
  /** The comparison on show, or null on a project never snapshotted. */
  comparison: ScopeComparisonView | null;
  /**
   * Whether anything has been agreed yet, which decides whether there is
   * anything to record. Taken as a flag rather than the rows, because this
   * section shows no deliverable and handing it the list would invite it to.
   */
  scopeIsEmpty: boolean;
  take: Parameters<typeof TakeSnapshotForm>[0]["take"];
}) {
  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Scope snapshots
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        The list above is what is agreed now, and it is the only thing a scope
        list can be. A snapshot records what it said at one moment — at signing,
        before a change order — so that everything added, dropped or
        re-estimated since is a fact with a date on it rather than two people
        remembering differently.
      </p>

      {comparison === null ? (
        <NoSnapshots />
      ) : (
        <>
          <ScopeComparison
            snapshot={comparison.snapshot}
            diff={comparison.diff}
          />
          <SnapshotPicker
            projectId={projectId}
            snapshots={snapshots}
            currentId={comparison.snapshot.id}
          />
        </>
      )}

      <div className="mt-8">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Record this scope list as it stands
        </h4>
        {scopeIsEmpty ? (
          <NothingToRecord />
        ) : (
          <TakeSnapshotForm
            take={take}
            initialState={INITIAL_TAKE_SNAPSHOT_STATE}
          />
        )}
      </div>
    </section>
  );
}

/**
 * The project has never been snapshotted, so there is nothing to compare
 * against.
 *
 * It says what a snapshot would be for rather than only that there is none,
 * because the answer is the form directly underneath — and because the moment
 * worth recording is usually one that has already passed. A reader who learns
 * about this feature a month into an engagement should be told plainly that
 * today is the earliest moment they can still record, which is the one thing
 * that gets the press made now rather than later.
 */
function NoSnapshots() {
  return (
    <p className="mt-4 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      No snapshots of this project yet, so there is nothing to compare against.
      The usual moment is the day the scope is agreed — but a snapshot taken
      today still turns every later change into something with a date on it,
      and today is the earliest moment left.
    </p>
  );
}

/**
 * Nothing has been agreed, so there is nothing to record.
 *
 * The form is not rendered at all rather than rendered and refused. A label
 * box above a button that cannot work wastes a sentence somebody composed —
 * and the write refuses an empty scope list anyway, which covers the page
 * having been open while the last deliverable was deleted.
 *
 * That refusal's words rather than its own. The two are the same sentence —
 * the form is absent here for the reason the write would refuse there — and a
 * reader can meet both within one press: this one on a project with no lines,
 * the other on a project whose last line went in another tab. Written out
 * twice they were already three words apart, and the copy in `lib/` is the one
 * a test holds.
 */
function NothingToRecord() {
  return (
    <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      {SNAPSHOT_PROBLEMS.emptyScope}
    </p>
  );
}
