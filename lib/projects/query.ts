import {
  DEFAULT_PROJECT_STATUS_FILTER,
  type ProjectStatusFilter,
} from "./filter";
import { DEFAULT_PROJECT_SORT, type ProjectSort } from "./sort";

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
