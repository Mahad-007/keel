import { PROJECT_STATUSES, type ProjectStatus } from "./status";

/**
 * The status filter on the projects list is a status plus one more option:
 * no filter at all. That extra option has to be a real value rather than an
 * absent one, because it is what a link has to be able to point at to clear
 * the filter, and what the filter row has to be able to mark as current.
 */
export const ALL_STATUSES = "all";

export type ProjectStatusFilter = ProjectStatus | typeof ALL_STATUSES;

/** Unfiltered first, then the statuses in lifecycle order. */
export const PROJECT_STATUS_FILTERS = [
  ALL_STATUSES,
  ...PROJECT_STATUSES,
] as const satisfies readonly ProjectStatusFilter[];

export const DEFAULT_PROJECT_STATUS_FILTER: ProjectStatusFilter = ALL_STATUSES;

export function isProjectStatusFilter(
  value: unknown,
): value is ProjectStatusFilter {
  return (
    typeof value === "string" &&
    (PROJECT_STATUS_FILTERS as readonly string[]).includes(value)
  );
}

/**
 * A `?status=` param narrowed to a filter, falling back to showing everything.
 *
 * Falling back rather than erroring is the right call for a list: a stale
 * bookmark or a typo should show the projects, not a 500. The status is the
 * whole point of the page, so nothing is lost by showing more than was asked
 * for — and the filter row makes plain which one is actually in effect.
 */
export function parseProjectStatusFilter(value: unknown): ProjectStatusFilter {
  return isProjectStatusFilter(value) ? value : DEFAULT_PROJECT_STATUS_FILTER;
}

/**
 * The filter as the data layer wants it: a status to restrict to, or
 * `undefined` for no restriction.
 *
 * `all` is a fact about the UI — a tab that has to be nameable and linkable —
 * and the query has no use for it. Translating here keeps the sentinel out of
 * `lib/data/`, where a status column holding the string "all" would be a bug.
 */
export function filteredStatus(
  filter: ProjectStatusFilter,
): ProjectStatus | undefined {
  return filter === ALL_STATUSES ? undefined : filter;
}
