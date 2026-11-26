import { thresholdLines } from "@/lib/thresholds/describe";
import type { ResolvedThresholds } from "@/lib/thresholds/resolve";

/** Ties the panel's region to the heading that names it. */
const HEADING_ID = "thresholds-heading";

/**
 * The figures this project is judged by, and which row each one came from.
 *
 * Every verdict above this panel rests on these five numbers: the banner at the
 * top of the tab is reached from three of them, and the projection's caveats
 * from the other two. A reader who disagrees with a flag has nowhere to look
 * otherwise — the figures are not in the sentence that used them, and until this
 * panel existed the only way to find out what a project was being measured
 * against was to read the source.
 *
 * The provenance column is the point, and it is why this is a table rather than
 * five sentences. A figure alone cannot be acted on: 70% might be this
 * project's own setting, the client's agreement, or a default nobody has
 * looked at, and each of those is a different form to open. Three columns, read
 * across, answer "what, how much, and whose decision".
 *
 * Nothing is computed here. The resolution is `lib/thresholds/resolve.ts`, the
 * words are `lib/thresholds/describe.ts`, and this lays out the rows they hand
 * over.
 */
export function ThresholdsPanel({
  clientName,
  thresholds,
}: {
  /** The client whose settings the second rung of the chain belongs to. */
  clientName: string;
  /**
   * The settings in force, resolved by the panel above from the project and
   * the client the join carried.
   *
   * Passed in rather than resolved here, like the banner's and the
   * projection's: the whole tab has to be judged by one reading, or this table
   * would be a second opinion about the figures the verdict above it was
   * reached at.
   */
  thresholds: ResolvedThresholds;
}) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800"
    >
      <h3
        id={HEADING_ID}
        className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        Thresholds
      </h3>
      {/*
        The chain, once, above the table. Spelling it out per row would repeat
        it five times; leaving it out would make the third column read as a
        label rather than as the answer to "who decided this".
      */}
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        What this project is flagged at. A figure set on the project wins;
        failing that it follows {clientName}; failing that it is the default
        Keel ships.
      </p>
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="sr-only">
          Every threshold in force for this project, what it is set to, and
          which row it came from.
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th scope="col" className="py-2 pr-6 font-medium">
              Setting
            </th>
            <th scope="col" className="py-2 pr-6 text-right font-medium">
              In force
            </th>
            <th scope="col" className="py-2 font-medium">
              Where from
            </th>
          </tr>
        </thead>
        <tbody>
          {thresholdLines(thresholds).map((line) => (
            <tr
              key={line.label}
              className="border-b border-zinc-100 align-baseline dark:border-zinc-900"
            >
              {/*
                The row header, with what the setting does under it in smaller
                type. A reader scanning for the figure that produced a flag
                needs the sentence to tell the two percentages apart, and a
                tooltip would hide it from exactly the reader who is reading
                down the column.
              */}
              <th scope="row" className="py-2 pr-6 text-left font-normal">
                <span className="text-zinc-900 dark:text-zinc-100">
                  {line.label}
                </span>
                <span className="mt-0.5 block max-w-prose text-xs leading-5 font-normal text-zinc-500 dark:text-zinc-400">
                  {line.hint}
                </span>
              </th>
              <td className="py-2 pr-6 text-right tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                {line.value}
              </td>
              <td className="py-2 text-zinc-500 dark:text-zinc-400">
                {line.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
