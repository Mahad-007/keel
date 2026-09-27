/**
 * A project page has more on it than fits on one screen: the scope agreed, the
 * time logged, the change orders raised, the invoices sent. Those arrive over
 * the next five phases, and they are separate readings of the same engagement
 * rather than one long scroll — so the page is tabbed from the start.
 *
 * The tabs live here, in lifecycle order, because that is the order the work
 * happens in: you agree scope, you burn time against it, you raise a change
 * order when it slips, and you invoice what you did.
 */
export const PROJECT_TABS = [
  "overview",
  "scope",
  "time",
  "changes",
  "invoices",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

/**
 * The tab a project page opens on. Overview is the only one with anything on
 * it today, and it stays the default afterwards: it is the summary the other
 * four are details of.
 */
export const DEFAULT_PROJECT_TAB: ProjectTab = "overview";

/**
 * Narrows an unknown string — a `?tab=` param, a value out of a link someone
 * hand-edited — to one of the tabs.
 */
export function isProjectTab(value: unknown): value is ProjectTab {
  return (
    typeof value === "string" &&
    (PROJECT_TABS as readonly string[]).includes(value)
  );
}

/**
 * A `?tab=` param narrowed to a tab, falling back to the default.
 *
 * Falling back rather than 404ing is the right call: the tab is a view of a
 * project that exists, and a stale bookmark pointing at a tab that was renamed
 * should still show the project. Which tab you are on is visible on the page,
 * so nothing is hidden by landing somewhere other than asked.
 */
export function parseProjectTab(value: unknown): ProjectTab {
  return isProjectTab(value) ? value : DEFAULT_PROJECT_TAB;
}
