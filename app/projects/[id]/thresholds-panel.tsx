import Link from "next/link";

import { CaveatNote } from "@/components/form";
import { projectEditPath } from "@/lib/projects/detail";
import {
  describeNearlySpentSetting,
  thresholdLines,
  thresholdProblemSentences,
} from "@/lib/thresholds/describe";
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
  projectId,
  clientId,
  clientName,
  thresholds,
}: {
  /** The project whose form sets the first rung of the chain. */
  projectId: string;
  /** The client whose form sets the second. */
  clientId: string;
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
  const problems = thresholdProblemSentences(thresholds);

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
      {/*
        What is wrong with the settings themselves, above the table they are
        about. Nothing that changes how a figure reads is allowed to arrive
        underneath it, which is the rule the projection panel keeps for its
        caveats — and a reader who scrolled past the table has already believed
        the numbers.

        One note per problem rather than a paragraph running them together,
        because each quotes its own figures and sends a reader to its own form.
        Usually there are none: an unusable figure is a row somebody wrote
        straight to the database, and a crossed pair is two fields that are each
        legal on their own.
      */}
      {problems.map((problem) => (
        <CaveatNote key={problem} className="mt-3">
          {problem}
        </CaveatNote>
      ))}
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
      {/*
        What the money threshold costs, under the table rather than in it. It is
        the one setting of the five whose consequence is not obvious from the
        figure: the row says when the banner appears, and this says what is left
        at that point to cover the rest of the work, which is the judgement a
        reader is actually being asked to agree with.

        Only this setting gets a sentence. A gap threshold has no remainder and a
        window of days has nothing to be a share of, so the other four would be
        the figure restated — and five sentences under a five-row table is a
        paragraph nobody reads.
      */}
      <p className="mt-3 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {describeNearlySpentSetting(thresholds.nearlySpentPercent.value)}
      </p>
      {/*
        Both forms, named, because the table has just told a reader which row
        each figure came from and the useful next move is to open that row.
        Offering only the project's form would send everybody who wanted to move
        a figure for the whole engagement to the one place that changes it for a
        single job.
      */}
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Change them{" "}
        <Link
          href={projectEditPath(projectId)}
          className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          on this project
        </Link>{" "}
        or{" "}
        <Link
          href={`/clients/${encodeURIComponent(clientId)}/edit`}
          className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          for {clientName}
        </Link>
        .
      </p>
    </section>
  );
}
