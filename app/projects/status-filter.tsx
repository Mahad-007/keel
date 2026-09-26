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
export function StatusFilter({ query }: { query: ProjectsQuery }) {
  return (
    <nav aria-label="Filter projects by status" className="mt-6">
      <ul className="flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {PROJECT_STATUS_FILTERS.map((filter) => (
          <li key={filter}>
            <Link
              href={projectsHref(withStatus(query, filter))}
              className="-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
            >
              {projectStatusFilterLabel(filter)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
