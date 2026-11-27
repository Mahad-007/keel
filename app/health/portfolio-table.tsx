import Link from "next/link";

import { clientEditPath } from "@/lib/clients/detail";
import type { PortfolioRow } from "@/lib/health/row";
import {
  PORTFOLIO_CAPTION,
  PORTFOLIO_COLUMNS,
  portfolioReading,
} from "@/lib/health/words";
import { projectPath } from "@/lib/projects/detail";

import { VerdictCell } from "./verdict-cell";

/**
 * Every active project, worst first.
 *
 * A table, because every column is a fact worth comparing down the page and
 * the comparison only works when the figures line up under one another. The
 * question this page answers — which engagement is in the most trouble — is a
 * question about a column rather than about a row, and a column is what a
 * table has.
 *
 * The order is the ranking, and nothing on screen repeats it as a number. A
 * rank column would be a figure that says nothing a reader cannot see from
 * where the row is, and it would go stale the moment they sorted by something
 * else. The caption says the order for anybody who cannot see it.
 *
 * The three figure columns come before the verdict rather than after it, so a
 * reader runs left to right from what happened to what it means. Reversing
 * them would put the conclusion in front of its evidence, which is the one
 * order this app does not use.
 */
export function PortfolioTable({ rows }: { rows: readonly PortfolioRow[] }) {
  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <caption className="sr-only">{PORTFOLIO_CAPTION}</caption>
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-6 font-medium">
            {PORTFOLIO_COLUMNS.project}
          </th>
          <th scope="col" className="py-2 pr-6 font-medium">
            {PORTFOLIO_COLUMNS.client}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {PORTFOLIO_COLUMNS.burned}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {PORTFOLIO_COLUMNS.consumed}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {PORTFOLIO_COLUMNS.delivered}
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            {PORTFOLIO_COLUMNS.gap}
          </th>
          <th scope="col" className="py-2 font-medium">
            {PORTFOLIO_COLUMNS.verdict}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const reading = portfolioReading(row);

          return (
            <tr
              key={row.project.id}
              className="border-b border-zinc-100 align-baseline dark:border-zinc-900"
            >
              {/*
                The project is the row header: every other cell is a fact about
                it, and it is what somebody navigating by row wants read out
                before the figures. It is also the way in to the project page,
                where the same verdict is argued at length.
              */}
              <th
                scope="row"
                className="py-2.5 pr-6 text-left font-medium text-zinc-900 dark:text-zinc-100"
              >
                <Link
                  href={projectPath(row.project.id)}
                  className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
                >
                  {row.project.name}
                </Link>
              </th>
              <td className="py-2.5 pr-6 text-zinc-700 dark:text-zinc-300">
                <Link
                  href={clientEditPath(row.project.clientId)}
                  className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
                >
                  {row.project.clientName}
                </Link>
                {/*
                  An archived client keeps their active projects — the work is
                  still happening — but the name on its own would read as a
                  live client. Saying so here explains why they are missing
                  from the client book, as the projects list does.
                */}
                {row.project.clientArchivedAt !== null && (
                  <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                    (archived)
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {reading.burned}
              </td>
              <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {reading.consumed}
              </td>
              <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {reading.delivered}
              </td>
              <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {reading.gap}
              </td>
              <td className="py-2.5 text-zinc-700 dark:text-zinc-300">
                <VerdictCell reading={reading} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
