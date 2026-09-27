import Link from "next/link";

import type { ProjectWithClient } from "@/lib/data/projects";
import { describeProjectLifecycle } from "@/lib/projects/lifecycle";
import { PROJECTS_PATH } from "@/lib/projects/query";

import { ContractValue } from "../contract-value";
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
        href={PROJECTS_PATH}
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
          {/*
            The contract value is the number every later phase is measured
            against — burn, creep, what a change order is worth — so it belongs
            in the header rather than a tab, where it stays on screen whichever
            tab is open.
          */}
          <dl className="mt-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Contract value
            </dt>
            <dd className="mt-0.5 text-lg tabular-nums text-zinc-900 dark:text-zinc-100">
              <ContractValue cents={project.contractValueCents} />
            </dd>
          </dl>
        </div>
      </div>
      {/*
        The badge says which state the project is in; this says since when, and
        it is the half a reader actually acts on. "Paused" alone is a fact;
        "paused, having started in March" is a reason to go and do something.
      */}
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {describeProjectLifecycle(project)}
      </p>
      {/*
        Archiving a client hides them from the client list but leaves their
        projects alone, so the client link above points somewhere the reader
        cannot otherwise reach. Saying so here stops that reading as a broken
        link, and stops the project reading as live work for a live client.
      */}
      {project.clientArchivedAt === null ? null : (
        <p className="mt-2 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
          {project.clientName} is archived and no longer on the client list.
          This project is not: closing the book on a client does not undo the
          work that was done for them.
        </p>
      )}
    </header>
  );
}
