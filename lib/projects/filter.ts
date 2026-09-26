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
