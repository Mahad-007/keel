import {
  describeScopeDiff,
  describeUnchangedLines,
} from "@/lib/snapshots/describe";
import { movedScopeLines, type ScopeDiff } from "@/lib/snapshots/diff";
import {
  snapshotTakenLabel,
  type SummarisedSnapshot,
} from "@/lib/snapshots/summary";

import { ScopeDiffTable } from "./scope-diff-table";

/**
 * What has changed since one snapshot: the paragraph, then the rows behind it.
 *
 * The paragraph goes first because it is what the reader came for, and because
 * it is the part that gets forwarded to a client. The table is the working — a
 * reader who accepts the sentence never has to read it, and a reader who does
 * not can check every row against the scope list above.
 *
 * The heading names the snapshot rather than saying "Changes", so a page
 * printed or screenshotted still says what it is a comparison against. That is
 * the whole argument this page exists to settle, and a heading reading
 * "Changes" would lose it.
 */
export function ScopeComparison({
  snapshot,
  diff,
}: {
  /** The snapshot being compared against, for the heading to name. */
  snapshot: SummarisedSnapshot;
  diff: ScopeDiff;
}) {
  const moved = movedScopeLines(diff.entries);
  const unchanged = describeUnchangedLines(diff.summary);

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Changes since {snapshotTakenLabel(snapshot)}
      </h4>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {describeScopeDiff(diff.summary)}
      </p>
      {/*
        No table when nothing moved: the sentence above has already said so,
        and a table with a header row and no rows under it reads as a page
        that failed to load.
      */}
      {moved.length === 0 ? null : (
        <div className="mt-4">
          <ScopeDiffTable entries={moved} />
        </div>
      )}
      {/*
        Under the table rather than over it, because it is about what is not
        in it — a reader has to have seen the rows for the count to mean
        anything.
      */}
      {unchanged === null ? null : (
        <p className="mt-3 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {unchanged}
        </p>
      )}
    </div>
  );
}
