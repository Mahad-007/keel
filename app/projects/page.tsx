import type { Metadata } from "next";
import Link from "next/link";

import {
  countProjectsByStatus,
  listProjectsWithClient,
} from "@/lib/data/projects";
import {
  ALL_STATUSES,
  describeProjectsShown,
  filterCount,
  filteredStatus,
} from "@/lib/projects/filter";
import {
  parseProjectsQuery,
  projectsHref,
  withStatus,
} from "@/lib/projects/query";

import { NoMatchingProjects, NoProjects } from "./empty-state";
import { ProjectsTable } from "./projects-table";
import { StatusFilter } from "./status-filter";

/**
 * Read at request time. The filter and the sort come off the URL, so there is
 * nothing to prerender anyway, and a project list cached at deploy time would
 * be wrong the moment anything moved.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects · Keel",
};

export default async function ProjectsPage({
  searchParams,
}: PageProps<"/projects">) {
  const query = parseProjectsQuery(await searchParams);

  /**
   * Two queries, not one: the table is filtered and the tab counts are not, so
   * the counts cannot be derived from the rows on screen. They are independent,
   * so they go in parallel.
   */
  const [projects, counts] = await Promise.all([
    listProjectsWithClient({
      status: filteredStatus(query.status),
      sort: query.sort,
    }),
    countProjectsByStatus(),
  ]);

  const total = filterCount(counts, ALL_STATUSES);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 font-sans">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {describeProjectsShown(query.status, projects.length, total)}
          </p>
        </div>
        <Link
          href="/clients"
          className="shrink-0 text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Clients
        </Link>
      </header>

      <StatusFilter query={query} counts={counts} />

      {/*
        Three outcomes, and they are not the same page. Rows are rows; an empty
        book needs explaining; and a filter that hid everything needs the way
        back out. Falling back to the first empty state for an unfiltered list
        keeps the "no work yet" explanation for the case that is actually that.
      */}
      {projects.length > 0 ? (
        <ProjectsTable projects={projects} query={query} />
      ) : total === 0 || query.status === ALL_STATUSES ? (
        <NoProjects />
      ) : (
        <NoMatchingProjects
          status={query.status}
          total={total}
          clearHref={projectsHref(withStatus(query, ALL_STATUSES))}
        />
      )}
    </main>
  );
}
