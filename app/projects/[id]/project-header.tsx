import Link from "next/link";

import type { ProjectWithClient } from "@/lib/data/projects";

import { ProjectStatusBadge } from "../status-badge";

/**
 * The top of a project page: what the engagement is, and who it is for.
 *
 * The client is a link because a project is never looked at for long without
 * the question "what rate do they bill at" coming up, and the client page is
 * where that is answered. It points at the edit page because that is the only
 * client page there is; a read-only client view arrives later.
 *
 * The status sits opposite the name rather than beside it: it is the fact that
 * changes, and a reader coming back to a project they know is looking for what
 * state it is in now, not for its name again.
 */
export function ProjectHeader({ project }: { project: ProjectWithClient }) {
  return (
    <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
      <Link
        href="/projects"
        className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Projects
      </Link>
      <div className="mt-2 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            for{" "}
            <Link
              href={`/clients/${project.clientId}/edit`}
              className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
            >
              {project.clientName}
            </Link>
          </p>
        </div>
        <div className="shrink-0 pt-1 text-right">
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>
    </header>
  );
}
