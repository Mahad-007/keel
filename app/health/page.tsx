import type { Metadata } from "next";
import Link from "next/link";

import { scopeLinesByProject } from "@/lib/data/deliverables";
import {
  countProjectsByStatus,
  listProjectsWithClient,
} from "@/lib/data/projects";
import { timeTotalsByProject } from "@/lib/data/time-entries";
import { buildPortfolio } from "@/lib/health/portfolio";
import { HEALTH_TITLE, PORTFOLIO_STATUS } from "@/lib/health/route";
import { describePortfolio } from "@/lib/health/words";
import { PROJECTS_PATH } from "@/lib/projects/query";

import { NoProjectsToRank, NothingActiveToRank } from "./nothing-to-rank";
import { PortfolioTable } from "./portfolio-table";

/**
 * Read at request time. Every figure on this page is a reading of what is true
 * now — an hour logged this morning moves a row up the table — and a version
 * cached at deploy time would rank a studio as it stood at the last release.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${HEALTH_TITLE} · Keel`,
};

export default async function HealthPage() {
  /*
    Four reads, all independent, so all at once. Three build the table and the
    fourth is only for the empty state — which is the one case the table cannot
    speak for itself, because an empty portfolio has two very different causes
    and the rows cannot tell them apart.

    One query per table rather than one per project. A studio with forty open
    engagements would otherwise spend forty round trips to print forty lines,
    and the page would get slower the more work there was to worry about. The
    grouping happens in SQL and the matching happens in `buildPortfolio`.

    The projects are narrowed to the active ones in the query rather than here.
    Which engagements belong on this page is a question about the studio, and
    the predicate is cheaper than the rows it leaves out.
  */
  const [projects, totals, lines, statusCounts] = await Promise.all([
    listProjectsWithClient({ status: PORTFOLIO_STATUS }),
    timeTotalsByProject(),
    scopeLinesByProject(),
    countProjectsByStatus(),
  ]);

  const rows = buildPortfolio(projects, totals, lines);
  const anyProjects = Object.values(statusCounts).some((count) => count > 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 font-sans">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {HEALTH_TITLE}
          </h1>
          {/*
            The summary before the table, because whether there is anything to
            do today is the thing a reader wants before they read a single row
            — and on a good day it is the only line they need.

            Left off when there is no table, because the panel below says the
            same thing with the reason attached. "No active projects." above
            "No active projects." is one sentence twice, and the second is the
            one worth reading — the same arrangement the timesheet keeps.
          */}
          {rows.length === 0 ? null : (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {describePortfolio(rows)}
            </p>
          )}
        </div>
        {/*
          The projects list is the other way to read the same engagements: this
          page is the active ones ranked by risk, and that one is all of them in
          the order they were set up, filterable by status.
        */}
        <Link
          href={PROJECTS_PATH}
          className="shrink-0 text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          All projects
        </Link>
      </header>

      {/*
        Three outcomes, and they are not the same page. A table is a table; a
        studio with no projects needs telling what this one is for; and a studio
        whose projects are all drafts or closed needs telling why none of them
        is here. The rows cannot tell the last two apart, which is the only
        reason the status counts are read at all.
      */}
      {rows.length > 0 ? (
        <PortfolioTable rows={rows} />
      ) : anyProjects ? (
        <NothingActiveToRank />
      ) : (
        <NoProjectsToRank />
      )}

      {/*
        What the page is measuring, under the table rather than over it. A
        reader arrives wanting to know what is true and only asks how it was
        worked out once they disagree with a row — the same order the project
        page keeps, conclusion first and basis after.
      */}
      <section
        aria-labelledby="health-basis"
        className="mt-10 max-w-prose border-t border-zinc-200 pt-6 dark:border-zinc-800"
      >
        <h2
          id="health-basis"
          className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          How this is worked out
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Consumed is every logged hour valued at the project&rsquo;s rate — its
          own, else its client&rsquo;s — as a share of the contract value.
          Delivered is the estimate on the lines marked done as a share of the
          whole estimate. The gap between them is the figure that matters: high
          burn against low delivery is an engagement that will miss by a mile,
          and on the day it happens there is still budget in the bank and
          nothing overdue.
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Each project is judged at its own thresholds, else its
          client&rsquo;s, else the app&rsquo;s defaults. A project whose burn
          cannot be read is not called healthy — it is listed above the ones
          that are, with the field that would settle it.
        </p>
      </section>
    </main>
  );
}
