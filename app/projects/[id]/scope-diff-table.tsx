import {
  describeDiffEntry,
  diffEntryEstimate,
  diffEntryTitle,
  SCOPE_CHANGE_LABELS,
} from "@/lib/snapshots/describe";
import type { ScopeDiffEntry } from "@/lib/snapshots/diff";

/**
 * What has changed since a snapshot, line by line.
 *
 * A table, because every column is a fact worth comparing down the page:
 * whether the line is new, gone or different, what it is called, what it is
 * estimated at, and what actually moved. It holds only the rows that changed —
 * `movedScopeLines` decides that, and the sentence under the table says how
 * many untouched lines are not in it.
 *
 * No colour carries meaning. The kind is a word in its own column, because
 * "Dropped" is unambiguous where a red row is a guess, and because this is a
 * table somebody reads out to a client over the phone. The only emphasis is
 * weight on the title, which is what a reader scans.
 */
export function ScopeDiffTable({
  entries,
}: {
  /** The rows that moved, in the order the comparison produced them. */
  entries: readonly ScopeDiffEntry[];
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Deliverables added, dropped or changed since this snapshot was taken.
      </caption>
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-4 font-medium">
            Change
          </th>
          <th scope="col" className="py-2 pr-6 font-medium">
            Deliverable
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            Estimate
          </th>
          <th scope="col" className="py-2 font-medium">
            What moved
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.deliverableId}
            className="border-b border-zinc-100 align-baseline dark:border-zinc-900"
          >
            <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-400">
              {SCOPE_CHANGE_LABELS[entry.kind]}
            </td>
            {/*
              The title is the row header: it is what the other three cells are
              facts about, and it is what somebody navigating by row wants read
              out first.
            */}
            <th
              scope="row"
              className="py-2.5 pr-6 text-left font-medium text-zinc-900 dark:text-zinc-100"
            >
              {diffEntryTitle(entry)}
            </th>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
              {diffEntryEstimate(entry)}
            </td>
            <td className="py-2.5 text-zinc-600 dark:text-zinc-400">
              {/*
                A list, because a changed line can have four things to say
                about it and they are four separate facts. One sentence renders
                as one line without a bullet, which is what a single fact
                should look like.
              */}
              <ul className="flex flex-col gap-0.5">
                {describeDiffEntry(entry).map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
