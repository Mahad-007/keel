import { formatDate } from "@/lib/dates";

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

/**
 * The two dates read back as a sentence, for the project header.
 *
 * A header showing `startedAt` and `closedAt` as two labelled cells makes the
 * reader assemble the story themselves, and leaves the empty ones ambiguous —
 * a blank start date on a paused project could mean "never started" or "we
 * lost the date". One sentence says which, and says nothing at all about dates
 * the project does not have.
 *
 * The status leads, because it is the thing that is true now; the dates are
 * how it got there.
 */
export function describeProjectLifecycle(project: ProjectLifecycle): string {
  const started = project.startedAt;
  const closed = project.closedAt;

  switch (project.status) {
    case "draft":
      return "Not started — still a draft.";
    case "active":
      return started === null
        ? "Running."
        : `Running since ${formatDate(started)}.`;
    case "paused":
      return started === null
        ? "Paused."
        : `Paused, having started ${formatDate(started)}.`;
    case "closed":
      return describeClosed(started, closed);
    default:
      /**
       * The status column is plain TEXT in SQLite, so the four values are a
       * type-level promise a hand-edited row can break. Without this branch
       * such a row returns undefined and the header renders a blank line
       * where its sentence should be — the one failure that tells the reader
       * nothing at all. Naming the value says what is actually stored, the
       * same way the status label and the badge do.
       */
      return `Status "${String(project.status)}" is not one a project can be in.`;
  }
}

/**
 * A closed project is the one case with two dates worth having, and the span
 * between them is the fact somebody is actually after. Either date may be
 * missing on a row that was written by hand, so each is mentioned only if it
 * is there.
 */
function describeClosed(started: string | null, closed: string | null): string {
  if (closed === null) return "Closed.";
  if (started === null) return `Closed ${formatDate(closed)}.`;
  return `Ran from ${formatDate(started)} to ${formatDate(closed)}.`;
}
