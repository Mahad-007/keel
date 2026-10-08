import type { ScopeSummary } from "@/lib/scope";
import {
  describeEstimateProblem,
  SCOPE_FROM_ESTIMATES,
  scopeSummaryFigures,
} from "@/lib/projects/scope-summary";

import { SummaryFigure } from "./summary-figure";

/**
 * What a project's scope adds up to, at the top of the scope tab.
 *
 * Four figures and the sentences that make them readable: what the list was
 * estimated at, what has been handed over, what is left, and what the contract
 * value works out to an hour against the estimate. The last one is the reason
 * the panel exists — a deliverables list and a contract value are agreed in
 * separate conversations and almost never divided by one another, and the
 * quotient is usually the moment somebody discovers what they actually agreed
 * to.
 *
 * It sits above the list rather than below it, because the list is long and
 * the figures are the thing a reader came back for. Nothing here is
 * interactive and nothing is computed in the component: the arithmetic is
 * `summariseScope`, the words are `lib/projects/scope-summary.ts`, and this
 * maps one over the other.
 */
export function ScopeSummaryPanel({ summary }: { summary: ScopeSummary }) {
  /*
    A project with no deliverables has nothing to summarise, and four rows of
    "Not estimated" above an empty state that has just explained why the list
    matters would answer a question nobody asked. The empty state is the whole
    content of the tab until there is a first line.

    Decided here rather than by the caller so that every page which grows a
    scope summary later makes the same call — the condition is a fact about the
    summary, not about this tab.
  */
  if (summary.lineCount === 0) return null;

  const problem = describeEstimateProblem(summary);

  return (
    <section className="mt-6">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Scope summary
      </h3>
      {/*
        Above the figures, because it changes how all four of them are read and
        a caveat found underneath them arrives too late. Amber rather than red:
        the same tone the deletion step uses, for the same reason — nothing has
        failed and nothing is being refused, but a reader should not take these
        numbers at face value until the row behind them is fixed.
      */}
      {problem === null ? null : (
        <p className="mt-2 max-w-prose rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {problem}
        </p>
      )}
      <dl className="mt-2 text-sm">
        {scopeSummaryFigures(summary).map((figure) => (
          <SummaryFigure key={figure.label} {...figure} />
        ))}
      </dl>
      {/*
        Under the figures rather than over them: a reader who has come for the
        implied rate should reach it without a paragraph in the way, and the
        caveat is what they need on the way back out.
      */}
      <p className="mt-3 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {SCOPE_FROM_ESTIMATES}
      </p>
    </section>
  );
}
