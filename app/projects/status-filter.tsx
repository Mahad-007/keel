import {
  PROJECT_STATUS_FILTERS,
  filterCount,
  projectStatusFilterLabel,
} from "@/lib/projects/filter";
import {
  projectsHref,
  withStatus,
  type ProjectsQuery,
} from "@/lib/projects/query";
import type { ProjectStatus } from "@/lib/projects/status";

import { TabBar, TabLink } from "./tab-bar";

/**
 * The status filter: one link per option, each pointing at the same list
 * narrowed to that status.
 *
 * Links rather than a `<select>` and a submit, so filtering is a navigation —
 * no client JavaScript, the back button works, and a filtered list is an
 * address someone can send to somebody else.
 */
export function StatusFilter({
  query,
  counts,
}: {
  query: ProjectsQuery;
  /** Per-status totals, so each tab can say how many rows it would show. */
  counts: Record<ProjectStatus, number>;
}) {
  return (
    <TabBar label="Filter projects by status">
      {PROJECT_STATUS_FILTERS.map((filter) => (
        <TabLink
          key={filter}
          href={projectsHref(withStatus(query, filter))}
          current={filter === query.status}
        >
          {projectStatusFilterLabel(filter)}{" "}
          <span className="tabular-nums text-zinc-400 dark:text-zinc-600">
            {filterCount(counts, filter)}
          </span>
        </TabLink>
      ))}
    </TabBar>
  );
}
