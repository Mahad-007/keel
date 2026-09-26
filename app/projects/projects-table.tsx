import Link from "next/link";

import type { ProjectListRow } from "@/lib/data/projects";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { ProjectsQuery } from "@/lib/projects/query";
import { PROJECT_SORT_COLUMN_LABELS } from "@/lib/projects/sort";
import { projectStatusLabel } from "@/lib/projects/status";

import { SortableHeader } from "./sortable-header";

/**
 * The projects list itself.
 *
 * A table, because every column here is a fact worth comparing down the page:
 * which client, what state, how much was agreed, when it last moved. The
 * project name is not a link yet — there is no project page to send it to.
 */
export function ProjectsTable({
  projects,
  query,
}: {
  projects: ProjectListRow[];
  /** The current query, so the two date headers can link to the next sort. */
  query: ProjectsQuery;
}) {
  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <th scope="col" className="py-2 pr-6 font-medium">
            Project
          </th>
          <th scope="col" className="py-2 pr-6 font-medium">
            Client
          </th>
          <th scope="col" className="py-2 pr-6 font-medium">
            Status
          </th>
          <th scope="col" className="py-2 pr-6 text-right font-medium">
            Contract value
          </th>
          <SortableHeader query={query} column="created" className="pr-6 text-right">
            {PROJECT_SORT_COLUMN_LABELS.created}
          </SortableHeader>
          <SortableHeader query={query} column="updated" className="text-right">
            {PROJECT_SORT_COLUMN_LABELS.updated}
          </SortableHeader>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr
            key={project.id}
            className="border-b border-zinc-100 dark:border-zinc-900"
          >
            <td className="py-2.5 pr-6 font-medium text-zinc-900 dark:text-zinc-100">
              {project.name}
            </td>
            <td className="py-2.5 pr-6 text-zinc-700 dark:text-zinc-300">
              <Link
                href={`/clients/${project.clientId}/edit`}
                className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
              >
                {project.clientName}
              </Link>
              {/*
                An archived client keeps their projects — the work happened —
                but the name on its own would read as a live client. Saying so
                here explains why they are missing from /clients.
              */}
              {project.clientArchivedAt !== null && (
                <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                  (archived)
                </span>
              )}
            </td>
            <td className="py-2.5 pr-6 text-zinc-700 dark:text-zinc-300">
              {projectStatusLabel(project.status)}
            </td>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
              {project.contractValueCents === 0 ? (
                <span className="text-zinc-400 dark:text-zinc-600">Not set</span>
              ) : (
                formatCents(project.contractValueCents)
              )}
            </td>
            <td className="py-2.5 pr-6 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatDate(project.createdAt)}
            </td>
            <td className="py-2.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatDate(project.updatedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
