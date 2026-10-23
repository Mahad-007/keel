import { CaveatNote } from "@/components/form";

import {
  describeRollupTable,
  describeUnmatchedTime,
  NO_SCOPE_TO_ROLL_UP,
  ROLLUP_IS_HOURS_ONLY,
  rollupFigures,
  rollupRow,
} from "@/lib/projects/time-rollup";
import type { ProjectRollup } from "@/lib/time/rollup";

import { RollupTable } from "./rollup-table";
import { SummaryFigure } from "./summary-figure";

/**
 * What this project has logged, set against what it was estimated at.
 *
 * The project's four figures first, then a row per deliverable. That order is
 * the order the question is asked in: a reader wants to know whether the
 * engagement as a whole is in trouble before they want to know which line is
 * causing it, and somebody who only reads the first four lines has still
 * learned the thing that matters.
 *
 * Nothing here is interactive and nothing is computed in the component. The
 * arithmetic is `rollUpProject`, the words are `lib/projects/time-rollup.ts`,
 * and this maps one over the other — the same division the scope summary
 * keeps, through the same figure row.
 */
export function TimeRollupPanel({ rollup }: { rollup: ProjectRollup }) {
  /*
    A project with no time logged has no rollup: four figures reading "None
    yet" above a table of rows reading "None yet" would answer a question
    nobody asked, and the list below already says that nothing has been
    logged. The panel appears with the first entry.

    Decided here rather than by the caller so that every page which grows a
    rollup later makes the same call — the condition is a fact about the
    rollup, not about this tab.
  */
  if (rollup.entryCount === 0) return null;

  const unmatched = describeUnmatchedTime(rollup);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Against the estimates
      </h3>
      {/*
        Above the figures, because it says why the rows will not add up to the
        total and a caveat found underneath them arrives too late — the same
        place, and the same colour, the scope summary puts its own.
      */}
      {unmatched === null ? null : (
        <CaveatNote className="mt-2">{unmatched}</CaveatNote>
      )}
      <dl className="mt-2 text-sm">
        {rollupFigures(rollup).map((figure) => (
          <SummaryFigure key={figure.label} {...figure} />
        ))}
      </dl>
      {/*
        The per-deliverable half. A project with no scope list gets the
        sentence instead: a table with a header row and no rows under it reads
        as a page that failed to load, and the sentence says where the missing
        half is written.
      */}
      {rollup.lines.length === 0 ? (
        <p className="mt-4 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {NO_SCOPE_TO_ROLL_UP}
        </p>
      ) : (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Per deliverable
          </h4>
          <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {describeRollupTable(rollup)}
          </p>
          <div className="mt-3">
            <RollupTable rows={rollup.lines.map(rollupRow)} />
          </div>
        </div>
      )}
      {/*
        Under everything rather than over it: a reader who has come for the
        overrun should reach it without a paragraph in the way, and the caveat
        is what they need on the way back out.
      */}
      <p className="mt-4 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {ROLLUP_IS_HOURS_ONLY}
      </p>
    </section>
  );
}
