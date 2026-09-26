import {
  PROJECT_STATUSES,
  projectStatusLabel,
  type ProjectStatus,
} from "./status";

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

/**
 * The word on a filter tab. The statuses use their own label; the unfiltered
 * option says "All projects" rather than "All", because the tabs sit under a
 * heading and "All" on its own leaves the reader to guess all of what.
 */
export function projectStatusFilterLabel(filter: ProjectStatusFilter): string {
  return filter === ALL_STATUSES ? "All projects" : projectStatusLabel(filter);
}

/**
 * How many projects a filter tab would show, given a count per status.
 *
 * The unfiltered tab is the sum rather than a separate query: the per-status
 * counts already account for every project, and asking the database twice for
 * the same number invites the two answers to disagree.
 */
export function filterCount(
  counts: Record<ProjectStatus, number>,
  filter: ProjectStatusFilter,
): number {
  if (filter !== ALL_STATUSES) return counts[filter];
  return PROJECT_STATUSES.reduce((total, status) => total + counts[status], 0);
}

/**
 * Why a filtered list came back empty, in a sentence.
 *
 * An empty table is ambiguous: it could mean there is no work, or it could mean
 * the filter is hiding all of it. Those call for completely different reactions
 * from the reader, so the empty state says which one it is and how many
 * projects the filter is holding back.
 */
export function describeNoMatches(status: ProjectStatus, total: number): string {
  const label = projectStatusLabel(status).toLowerCase();
  if (total === 1) {
    return `There is one project on the books, and it is not ${label}.`;
  }
  return `There are ${total} projects on the books, none of them ${label}.`;
}

/**
 * The line under the heading: how much of the book the table is showing.
 *
 * With no filter it is just a count. With one, it is a fraction, because the
 * useful fact then is not how many rows are on screen but how many are not —
 * a reader who forgets the filter is set will otherwise read four rows as the
 * whole business.
 */
export function describeProjectsShown(
  filter: ProjectStatusFilter,
  shown: number,
  total: number,
): string {
  if (total === 0) return "Nothing on the books yet.";
  if (filter === ALL_STATUSES) {
    return total === 1 ? "One project on the books." : `${total} projects on the books.`;
  }
  const noun = total === 1 ? "project" : "projects";
  return `${shown} of ${total} ${noun} on the books.`;
}
