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
