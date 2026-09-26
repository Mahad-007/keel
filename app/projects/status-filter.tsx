import Link from "next/link";

import {
  PROJECT_STATUS_FILTERS,
  projectStatusFilterLabel,
} from "@/lib/projects/filter";
import { projectsHref, withStatus, type ProjectsQuery } from "@/lib/projects/query";

/**
 * The status filter: one link per option, each pointing at the same list
 * narrowed to that status.
 *
 * Links rather than a `<select>` and a submit, so filtering is a navigation —
 * no client JavaScript, the back button works, and a filtered list is an
 * address someone can send to somebody else.
 */
/**
 * The tab you are on is marked twice over: `aria-current` so a screen reader
 * says so, and a solid underline so everyone else can see it. A filter row
 * where the active filter is not obvious is worse than no filter row, because
 * a short list then reads as "no projects" rather than "none in this status".
 */
const CURRENT_TAB =
  "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100";

const OTHER_TAB =
  "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100";

export function StatusFilter({ query }: { query: ProjectsQuery }) {
  return (
    <nav aria-label="Filter projects by status" className="mt-6">
      <ul className="flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {PROJECT_STATUS_FILTERS.map((filter) => {
          const current = filter === query.status;
          return (
            <li key={filter}>
              <Link
                href={projectsHref(withStatus(query, filter))}
                aria-current={current ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 px-3 py-2 text-sm ${current ? CURRENT_TAB : OTHER_TAB}`}
              >
                {projectStatusFilterLabel(filter)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
