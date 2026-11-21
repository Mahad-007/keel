import { BURN_DOWN_COLUMNS, type BurnDownRow } from "@/lib/burndown/table";

/**
 * Every reading behind the chart, at full precision, newest first.
 *
 * The same data as the line above it and not a summary of it: the chart is a
 * shape and this is the figures, and a shape cannot be read out loud, copied
 * into an email, or checked against an invoice. On a page that otherwise
 * prefers a table to a chart, this is the half that will get quoted.
 *
 * Four figure columns with a day beside them, all right-aligned and tabular,
 * because every one of them is read down the column rather than across the
 * row — the question is when the burn moved, and that is a scan of one
 * column.
 *
 * The day is the row header, so a reader navigating by row hears the date
 * before the amounts. The last column marks whether the reading was taken on
 * its own day; the caveat above the chart says what the distinction means,
 * because a word repeated down forty rows is not the place to explain it.
 */
export function BurnDownTable({ rows }: { rows: readonly BurnDownRow[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Every stored reading of this project&rsquo;s burn-down, newest first,
        with the hours logged and the amounts they came to by the end of each
        day.
      </caption>
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-6 font-medium">
            {BURN_DOWN_COLUMNS.day}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {BURN_DOWN_COLUMNS.logged}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {BURN_DOWN_COLUMNS.burned}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {BURN_DOWN_COLUMNS.left}
          </th>
          <th scope="col" className="py-2 font-medium">
            {BURN_DOWN_COLUMNS.reading}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.onDate}
            className="border-b border-zinc-100 align-baseline dark:border-zinc-900"
          >
            <th
              scope="row"
              className="py-2 pr-6 text-left font-normal tabular-nums text-zinc-900 dark:text-zinc-100"
            >
              {row.day}
            </th>
            <td className="py-2 pr-6 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
              {row.logged}
            </td>
            <td className="py-2 pr-6 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
              {row.burned}
            </td>
            {/*
              The one figure in the page's own ink, because it is the figure
              the line above is drawn from. A reader who has just looked at
              the chart and come down here is looking for this column.
            */}
            <td className="py-2 pr-6 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
              {row.left}
            </td>
            <td className="py-2 text-zinc-500 dark:text-zinc-400">
              {row.reading}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
