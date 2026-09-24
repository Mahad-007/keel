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

/**
 * What the two timestamps should be once the project sits in `next`.
 *
 * Three rules, in the order they bite:
 *   - `active` is what "the work began" means, so it stamps `startedAt` the
 *     first time and never rewrites it — a project paused and resumed started
 *     once.
 *   - `draft` is the before-anything state, so returning to it clears both
 *     stamps. A draft carrying a start date claims something untrue.
 *   - `closed` stamps `closedAt`, and re-closing an already-closed project
 *     keeps the first time rather than rewriting history. Any other status
 *     clears it, which is what reopening a project means.
 */
export function lifecycleStamps(
  current: ProjectLifecycle,
  next: ProjectStatus,
  now: string,
): LifecycleStamps {
  return {
    startedAt: startedAtFor(current, next, now),
    closedAt: closedAtFor(current, next, now),
  };
}

function startedAtFor(
  current: ProjectLifecycle,
  next: ProjectStatus,
  now: string,
): string | null {
  if (next === "draft") return null;
  if (next === "active") return current.startedAt ?? now;
  return current.startedAt;
}

function closedAtFor(
  current: ProjectLifecycle,
  next: ProjectStatus,
  now: string,
): string | null {
  if (next !== "closed") return null;
  if (current.status === "closed") return current.closedAt ?? now;
  return now;
}
