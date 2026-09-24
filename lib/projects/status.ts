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
