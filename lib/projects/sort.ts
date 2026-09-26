/**
 * How the projects list is ordered.
 *
 * Two columns, because they answer two different questions. `created` is the
 * order work was taken on, which is what a list of engagements usually wants.
 * `updated` is the order work was last touched, which is what you want when
 * you are looking for the project you were in yesterday — or for the one
 * nobody has touched in a month.
 *
 * The values are the literal strings that appear in the URL, so a sorted list
 * is a link somebody can bookmark rather than state trapped in a component.
 */
export const PROJECT_SORT_COLUMNS = ["created", "updated"] as const;

export type ProjectSortColumn = (typeof PROJECT_SORT_COLUMNS)[number];

/** Newest engagement first: the same order the unsorted data layer uses. */
export const DEFAULT_PROJECT_SORT_COLUMN: ProjectSortColumn = "created";

/**
 * Narrows a search param to a sort column. A URL is user input — hand-edited,
 * stale after a rename, or truncated by something in between — so the list has
 * to be able to ask whether a value is one of ours before it trusts it.
 */
export function isProjectSortColumn(value: unknown): value is ProjectSortColumn {
  return (
    typeof value === "string" &&
    (PROJECT_SORT_COLUMNS as readonly string[]).includes(value)
  );
}

/**
 * Which way a column runs. `desc` first everywhere: a date column read
 * ascending starts at the oldest row, which is almost never the row anybody
 * opened the list to find.
 */
export const SORT_DIRECTIONS = ["desc", "asc"] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

/** The other direction, for a header that has been clicked twice. */
export function oppositeDirection(direction: SortDirection): SortDirection {
  return direction === "desc" ? "asc" : "desc";
}

/** The same narrowing for `?direction=`, which arrives the same way. */
export function isSortDirection(value: unknown): value is SortDirection {
  return (
    typeof value === "string" &&
    (SORT_DIRECTIONS as readonly string[]).includes(value)
  );
}
