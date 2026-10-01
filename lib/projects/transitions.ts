import type { ProjectStatus } from "./status";

/**
 * Which status a project may move to from the one it is in.
 *
 * The statuses themselves are a list of four words; this is the shape of the
 * lifecycle they describe, and it is the part with opinions in it. Three of
 * them:
 *
 *   - **Draft is only a beginning.** Nothing may move back to it. A project
 *     that has started, or that was closed without ever starting, is a fact
 *     about the engagement; demoting it to a draft would erase that and leave
 *     the `startedAt` rule with nothing honest to say.
 *   - **Pausing presupposes running.** A draft has not started, so it cannot
 *     stop; a closed project has already stopped for good.
 *   - **Closed is not the end, but it is a door.** A closed project can be
 *     reopened — work does come back — and reopening is the one move that has
 *     to leave a sentence behind. That is the guard the whole day is about: a
 *     closed project cannot *silently* reopen.
 *
 * Every status is a key, so adding one to `PROJECT_STATUSES` without deciding
 * where it can go fails to compile.
 */
export const PROJECT_TRANSITIONS: Record<
  ProjectStatus,
  readonly ProjectStatus[]
> = {
  draft: ["active", "closed"],
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: ["active"],
};

/**
 * Where a project in `from` can go next.
 *
 * An unrecognised status gets an empty list rather than `undefined`. The
 * column is plain TEXT in SQLite, so the four values are a type-level promise
 * a hand-edited row can break, and a row like that should be refused every
 * move with a message — not crash the page that offers them.
 */
export function allowedTransitions(
  from: ProjectStatus,
): readonly ProjectStatus[] {
  return PROJECT_TRANSITIONS[from] ?? [];
}

/**
 * Whether `from → to` is a move the lifecycle allows.
 *
 * Deliberately false for `from === to`: staying put is not a transition, and a
 * guard that waved it through would let a second press of Close write a second
 * audit row saying nothing happened.
 */
export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/** A move, spelled the way the rest of this module keys them. */
function edge(from: ProjectStatus, to: ProjectStatus): string {
  return `${from}->${to}`;
}

/**
 * What each move is called, on the button that makes it.
 *
 * Keyed by the pair rather than by the destination, because the same
 * destination is a different act depending on where you are standing:
 * `draft → active` is starting work, `paused → active` is resuming it, and
 * `closed → active` is reopening something that was finished. A button
 * labelled "Active" for all three would make the reader work out which.
 *
 * `draft → closed` is "Cancel" for the same reason: nothing ran, so there is
 * nothing to close, and calling it closing would imply there was.
 */
const TRANSITION_VERBS: Record<string, string> = {
  "draft->active": "Start",
  "draft->closed": "Cancel",
  "active->paused": "Pause",
  "active->closed": "Close",
  "paused->active": "Resume",
  "paused->closed": "Close",
  "closed->active": "Reopen",
};

/**
 * The verb for a legal move, or null for one that cannot be made — so a caller
 * cannot render a button for a transition the guard would refuse.
 */
export function transitionVerb(
  from: ProjectStatus,
  to: ProjectStatus,
): string | null {
  if (!canTransition(from, to)) return null;
  return TRANSITION_VERBS[edge(from, to)] ?? null;
}
