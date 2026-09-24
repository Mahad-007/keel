import type { ProjectStatus } from "./status";

/**
 * `startedAt` and `closedAt` are derived from the status changes a project
 * goes through, not set by hand. Keeping the rule here — pure, taking the row
 * it is given — means the data layer never has to remember which status
 * stamps which column, and the rule can be tested without a database.
 */

/** The part of a project row the lifecycle rule reads. */
export type ProjectLifecycle = {
  status: ProjectStatus;
  startedAt: string | null;
  closedAt: string | null;
};

/** The part it writes back. */
export type LifecycleStamps = Pick<ProjectLifecycle, "startedAt" | "closedAt">;
