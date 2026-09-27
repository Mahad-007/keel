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

/**
 * The word on each tab. A record rather than a capitalisation of the key, so
 * `changes` can read as "Change orders" — the thing it holds — and so adding a
 * tab without deciding what to call it fails to compile.
 */
export const PROJECT_TAB_LABELS: Record<ProjectTab, string> = {
  overview: "Overview",
  scope: "Scope",
  time: "Time",
  changes: "Change orders",
  invoices: "Invoices",
};

/**
 * What each tab is for, in a sentence.
 *
 * Four of the five are empty until later phases fill them in, and an empty
 * panel under a bare heading tells a reader nothing — least of all whether the
 * section is empty because there is no data or because there is no feature.
 * Saying what belongs there answers that, and the sentences stay useful after
 * the sections are built: they are the description of the tab, not an apology
 * for it.
 */
export const PROJECT_TAB_SUMMARIES: Record<ProjectTab, string> = {
  overview:
    "The facts on record for this engagement: who it is for, what state it is in, and what was agreed.",
  scope:
    "The deliverables agreed for this project, what each was estimated at, and how that compares to the contract value.",
  time: "Every minute logged against this project, grouped by day and attributed to the deliverable it went into.",
  changes:
    "Change orders raised when the work outgrew what was agreed, and whether the client accepted them.",
  invoices:
    "What has been billed out of this project, what is still unbilled, and what is outstanding.",
};
