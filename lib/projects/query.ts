import {
  DEFAULT_PROJECT_STATUS_FILTER,
  parseProjectStatusFilter,
  type ProjectStatusFilter,
} from "./filter";
import {
  DEFAULT_PROJECT_SORT,
  DEFAULT_PROJECT_SORT_COLUMN,
  DEFAULT_SORT_DIRECTION,
  isProjectSortColumn,
  isSortDirection,
  type ProjectSort,
} from "./sort";

/**
 * Everything the projects list reads off the URL: which statuses to show and
 * how to order them.
 *
 * The URL is the only place this state lives. A filtered, sorted list is then
 * a link — shareable, bookmarkable, survives a reload, and works with the back
 * button — and the page stays a server component with no state of its own.
 */
export type ProjectsQuery = {
  status: ProjectStatusFilter;
  sort: ProjectSort;
};

/** What `/projects` with no params means: everything, newest first. */
export const DEFAULT_PROJECTS_QUERY: ProjectsQuery = {
  status: DEFAULT_PROJECT_STATUS_FILTER,
  sort: DEFAULT_PROJECT_SORT,
};

/** The param names, named once so the parser and the links cannot disagree. */
export const STATUS_PARAM = "status";
export const SORT_PARAM = "sort";
export const DIRECTION_PARAM = "direction";

/**
 * The shape Next hands a page: a repeated param arrives as an array, and an
 * absent one as `undefined`.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The first value of a param. `?status=active&status=closed` is not a thing the
 * list can mean, and the choice of which one to honour matters less than making
 * it the same choice every time.
 */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads a query off the search params, replacing anything unrecognised with
 * the default for that one field. Every param is independent: a bad
 * `?direction=` does not throw away a good `?status=`, because a URL mangled
 * in one place is still a request for the rest of what it asks.
 */
export function parseProjectsQuery(params: SearchParams): ProjectsQuery {
  const column = firstValue(params[SORT_PARAM]);
  const direction = firstValue(params[DIRECTION_PARAM]);

  return {
    status: parseProjectStatusFilter(firstValue(params[STATUS_PARAM])),
    sort: {
      column: isProjectSortColumn(column) ? column : DEFAULT_PROJECT_SORT_COLUMN,
      direction: isSortDirection(direction) ? direction : DEFAULT_SORT_DIRECTION,
    },
  };
}
