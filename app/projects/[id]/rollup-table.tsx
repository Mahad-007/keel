import { ROLLUP_COLUMNS, type RollupRow } from "@/lib/projects/time-rollup";

/**
 * What each line of scope was estimated at and what it has actually taken.
 *
 * A table, because every column is a fact worth comparing down the page and
 * the comparison only works when the figures line up under one another. The
 * alternative — a sentence per deliverable — reads well for three lines and
 * becomes unscannable at nineteen, which is the length at which this panel
 * starts earning its place.
 *
 * The rows are in the order the scope was agreed, not sorted by overrun. That
 * order is what lets a reader hold this table beside the scope tab and find
 * the same line in both; sorting by the worst would make the table easier to
 * skim and impossible to cross-reference. The sentence above it counts the
 * overruns so nothing is hidden by the choice.
 *
 * No colour carries meaning. "2h over" in the last column is unambiguous
 * where a red row is a guess, and this is a table somebody reads out on a
 * call. The only emphasis is weight on the title, which is what the eye
 * scans down.
 */
export function RollupTable({ rows }: { rows: readonly RollupRow[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Each deliverable with the time estimated for it and the time logged
        against it.
      </caption>
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-6 font-medium">
            {ROLLUP_COLUMNS.deliverable}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {ROLLUP_COLUMNS.estimated}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {ROLLUP_COLUMNS.logged}
          </th>
          <th scope="col" className="py-2 font-medium">
            {ROLLUP_COLUMNS.against}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.deliverableId}
            className="border-b border-zinc-100 align-baseline dark:border-zinc-900"
          >
            {/*
              The title is the row header: it is what the other three cells
              are facts about, and it is what somebody navigating by row wants
              read out before the figures.
            */}
            <th
              scope="row"
              className="py-2.5 pr-6 text-left font-medium text-zinc-900 dark:text-zinc-100"
            >
              {row.title}
            </th>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
              {row.estimated}
            </td>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
              {row.logged}
              {/*
                Under the figure rather than beside it, and only on the rare
                row where some of the time will not be invoiced. A clause on
                every row would be one nobody reads, and the one row it
                mattered on would look like the rest.
              */}
              {row.notChargeable === null ? null : (
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {row.notChargeable}
                </span>
              )}
            </td>
            <td className="py-2.5 text-zinc-600 dark:text-zinc-400">
              {row.against}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
