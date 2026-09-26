import Link from "next/link";

import type { ProjectListRow } from "@/lib/data/projects";
import { projectStatusLabel } from "@/lib/projects/status";

/**
 * The projects list itself.
 *
 * A table, because every column here is a fact worth comparing down the page:
 * which client, what state, how much was agreed, when it last moved. The
 * project name is not a link yet — there is no project page to send it to.
 */
export function ProjectsTable({
  projects,
}: {
  projects: ProjectListRow[];
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
            </td>
            <td className="py-2.5 pr-6 text-zinc-700 dark:text-zinc-300">
              {projectStatusLabel(project.status)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
