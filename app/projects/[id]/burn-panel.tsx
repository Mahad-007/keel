import { CaveatNote } from "@/components/form";

import type { BurnSummary } from "@/lib/burn";
import {
  BURN_IS_TIME_AT_A_RATE,
  burnFigures,
  burnProblems,
  hasBurnToShow,
} from "@/lib/projects/burn-summary";

import { SummaryFigure } from "./summary-figure";

/**
 * What this project has consumed of what it was agreed for.
 *
 * The four figures the whole scope-creep phase is built towards: the price,
 * what the hours have come to against it, what is left, and the share. Unlike
 * the two panels on the other tabs, this one compares money to money — the
 * scope summary divides estimates by each other and the rollup sets hours
 * against hours, and neither can say whether an overrun costs anything.
 *
 * Nothing here is interactive and nothing is computed in the component. The
 * arithmetic is `summariseBurn`, the words are
 * `lib/projects/burn-summary.ts`, and this maps one over the other through the
 * same figure row the other two panels use — so a reader moving between the
 * three tabs meets one kind of figure rather than three.
 *
 * No bar, no meter, no coloured dot for the percentage. A share is a number
 * and the sentence under it is what says whether the number is bad news; a
 * length of filled rectangle would say less and claim more.
 */
export function BurnPanel({ summary }: { summary: BurnSummary }) {
  // The panel's own visibility rule is a fact about the burn rather than about
  // this tab, so it is named and tested in `lib/projects/burn-summary.ts` and
  // merely consulted here.
  if (!hasBurnToShow(summary)) return null;

  const problems = burnProblems(summary);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Against the contract
      </h3>
      {/*
        Above the figures, because they change how every number below them is
        read and a caveat found underneath arrives too late — the same place,
        and the same tone, the other two panels put their own. Usually there
        are none; when there are two they stack, because they are separate
        things wrong and running them together would make one sentence of two
        problems.
      */}
      {problems.map((problem) => (
        <CaveatNote key={problem} className="mt-2">
          {problem}
        </CaveatNote>
      ))}
      <dl className="mt-2 text-sm">
        {burnFigures(summary).map((figure) => (
          <SummaryFigure key={figure.label} {...figure} />
        ))}
      </dl>
      {/*
        Under the figures rather than over them: a reader who has come for the
        share should reach it without a paragraph in the way, and the caveat is
        what they need on the way back out.
      */}
      <p className="mt-4 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {BURN_IS_TIME_AT_A_RATE}
      </p>
    </section>
  );
}
