import type { ScopeSummary } from "@/lib/scope";
import { scopeSummaryFigures } from "@/lib/projects/scope-summary";

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
  return (
    <section className="mt-6">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Scope summary
      </h3>
      <dl className="mt-2 text-sm">
        {scopeSummaryFigures(summary).map((figure) => (
          <SummaryFigure key={figure.label} {...figure} />
        ))}
      </dl>
    </section>
  );
}
