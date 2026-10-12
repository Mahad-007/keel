import { describeEstimate } from "@/lib/deliverables/list";
import { importSummary, type ImportPreview } from "@/lib/deliverables/import";

/**
 * What a pasted scope list was understood as, line by line, before any of it
 * is written.
 *
 * A table, because every column here is a fact worth comparing down the page
 * against the box above: which line of the paste, what it was read as a
 * deliverable called, how long it was sized at, and anything worth saying
 * about it. The point of the step is that the reader checks the parse rather
 * than the paste — twelve lines understood correctly look nothing like eleven
 * and a half, and this is the only place that difference is visible before the
 * rows exist.
 *
 * The line numbers are the paste's own, so a row flagged as line 9 points at
 * the ninth line of the box. Blank lines are not shown: they are not
 * deliverables, and a table with gaps in it reads as a table with mistakes in
 * it.
 */
export function ImportPreviewTable({ preview }: { preview: ImportPreview }) {
  return (
    <div className="mt-4">
      {/*
        The sentence first, because it is the thing a reader checks before
        reading any row: how many lines, how long, and whether anything is
        stopping the import. `role="status"` rather than a plain paragraph —
        the preview appears in response to a press, and without it a screen
        reader is given no notice that anything happened.
      */}
      <p
        role="status"
        className="max-w-prose text-sm leading-6 text-zinc-700 dark:text-zinc-300"
      >
        {importSummary(preview)}
      </p>
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="sr-only">
          The pasted lines as they were understood, in the order they would be
          added.
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th scope="col" className="py-2 pr-4 font-medium">
              Line
            </th>
            <th scope="col" className="py-2 pr-6 font-medium">
              Deliverable
            </th>
            <th scope="col" className="py-2 pr-6 text-right font-medium">
              Estimate
            </th>
            <th scope="col" className="py-2 font-medium">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((line) => (
            <tr
              key={line.number}
              className="border-b border-zinc-100 align-baseline dark:border-zinc-900"
            >
              <th
                scope="row"
                className="py-2.5 pr-4 text-left font-normal tabular-nums text-zinc-400 dark:text-zinc-500"
              >
                {line.number}
              </th>
              {line.ok ? (
                <>
                  <td className="py-2.5 pr-6 font-medium text-zinc-900 dark:text-zinc-100">
                    {line.draft.title}
                  </td>
                  <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {describeEstimate(line.draft.estimatedMinutes)}
                  </td>
                  <td className="py-2.5 text-zinc-600 dark:text-zinc-400">
                    {line.note}
                  </td>
                </>
              ) : (
                <>
                  {/*
                    A line that could not be read shows what was pasted rather
                    than nothing, because the sentence beside it is about that
                    text and the reader has to find it in the box. It is not
                    styled as a title: there is no deliverable here.
                  */}
                  <td className="py-2.5 pr-6 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {line.text}
                  </td>
                  <td className="py-2.5 pr-6 text-right text-zinc-400 dark:text-zinc-500">
                    —
                  </td>
                  <td className="py-2.5 text-red-700 dark:text-red-300">
                    {line.problem}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
