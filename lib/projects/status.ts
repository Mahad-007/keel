/**
 * A project's status is the one piece of project state the whole app reasons
 * about: the list filters on it, the detail header badges it, and the burn
 * calculations later on only care about projects that are open.
 *
 * The four values live here rather than inline in the schema so that the
 * column, the forms, and the labels are all reading the same list. Order is
 * lifecycle order — a project moves rightwards through it.
 */
export const PROJECT_STATUSES = [
  "draft",
  "active",
  "paused",
  "closed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** What a brand new project is, before anyone has committed to the work. */
export const DEFAULT_PROJECT_STATUS: ProjectStatus = "draft";

/**
 * Narrows an unknown string — a URL search param, a form field, a column read
 * back from an older row — to a status. Anything else is not a status, and the
 * caller decides whether that is a default or an error.
 */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * The strict form, for callers with nowhere sensible to fall back to — the
 * data layer writing a status column. The message lists the alternatives,
 * because the usual cause is a typo and the usual reader is a developer.
 */
export function parseProjectStatus(value: unknown): ProjectStatus {
  if (!isProjectStatus(value)) {
    throw new Error(
      `unknown project status: ${JSON.stringify(value)} (expected one of ${PROJECT_STATUSES.join(", ")})`,
    );
  }
  return value;
}
