import Link from "next/link";

import { projectTabHref } from "@/lib/projects/detail";
import { projectStatusLabel } from "@/lib/projects/status";
import { expectsTime, type TimesheetProject } from "@/lib/time/timesheet";

/**
 * A row's header: which project the seven cells beside it belong to.
 *
 * The project and its client, stacked, because neither alone identifies a row
 * — a studio with two clients who both call their engagement "Website" is the
 * ordinary case, and a column of bare project names is a sheet where somebody
 * logs an afternoon against the wrong one.
 *
 * The name links to the project's own time tab rather than to its overview.
 * The reason somebody clicks a row here is to see what the cells are made of,
 * and that list is what the cells are made of.
 *
 * A status is named only when it is not the one the sheet expects. An active
 * project is why most rows are here and saying so on every one of them would
 * be a word repeated down the page; a paused or closed project with hours in
 * the week is the row that needs explaining, because its presence is the
 * surprise.
 */
export function ProjectHeading({ project }: { project: TimesheetProject }) {
  return (
    <th
      scope="row"
      className="py-2.5 pr-6 text-left align-top font-medium text-zinc-900 dark:text-zinc-100"
    >
      <Link
        href={projectTabHref(project.id, "time")}
        className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
      >
        {project.name}
      </Link>
      <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
        {project.clientName}
        {!expectsTime(project) && ` · ${projectStatusLabel(project.status)}`}
      </span>
    </th>
  );
}
