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

/**
 * Whether a move may only be made with a reason attached.
 *
 * Exactly one qualifies, and it is the one the whole guard exists for:
 * reopening a closed project. Closing is a statement that the engagement is
 * finished — it is what stops the burn clock, what an invoice is cut against,
 * and what a client is told. Undoing it is not an edit, it is a decision, and
 * a decision with nobody's words against it is indistinguishable from a
 * misclick six months later.
 *
 * Every other move may carry a note and does not need one. Demanding a
 * sentence to pause a project would get "." typed into the box, which is worse
 * than no box: it makes the trail look answered when it is not.
 */
export function transitionRequiresReason(
  from: ProjectStatus,
  to: ProjectStatus,
): boolean {
  return from === "closed" && to === "active";
}

/**
 * How long a reason may be. Long enough for the two or three sentences that
 * actually explain a reopening, short enough that the column is not where
 * somebody pastes an email thread.
 */
export const TRANSITION_REASON_LIMIT = 500;

/**
 * Each status as it reads inside a sentence, which is not how it reads on a
 * badge: "already Draft" is not English, and "already a draft" is.
 */
const STATUS_PHRASES: Record<ProjectStatus, string> = {
  draft: "a draft",
  active: "active",
  paused: "paused",
  closed: "closed",
};

/** A status in a sentence, falling back to quoting whatever is stored. */
function phrase(status: ProjectStatus): string {
  return STATUS_PHRASES[status] ?? `"${String(status)}"`;
}

/**
 * Why the lifecycle will not make this move, or null if it will.
 *
 * A boolean guard is enough to stop a bad transition and not enough to explain
 * one. The person who pressed the button is looking at a project page that
 * offered them the move a moment ago — the honest answer is almost always that
 * the project moved underneath them, so each message says what is true now and
 * what to do about it, rather than restating the rule.
 */
export function refuseTransition(
  from: ProjectStatus,
  to: ProjectStatus,
): string | null {
  if (canTransition(from, to)) return null;

  if (from === to) return `This project is already ${phrase(to)}.`;
  if (to === "draft") {
    return "Draft is where a project starts, and nothing goes back to it once it has left.";
  }
  if (to === "paused" && from === "draft") {
    return "A project that has not started cannot be paused. Start it first.";
  }
  if (to === "paused" && from === "closed") {
    return "A closed project cannot be paused. Reopen it first if the work has come back.";
  }
  return `A project that is ${phrase(from)} cannot become ${phrase(to)}.`;
}

/**
 * Why a transition was refused: a code for the caller to branch on, and a
 * sentence for the person who asked for it.
 *
 * The code exists because the two kinds of refusal want different handling. A
 * missing reason is a field the user can fill in and resubmit; an illegal move
 * is not something any amount of typing fixes, and the page offering it is out
 * of date. A server action has to tell those apart to decide whether it is
 * marking a field or re-reading the project.
 */
export type TransitionProblemCode =
  | "illegal"
  | "reason-required"
  | "reason-too-long";

export type TransitionProblem = {
  readonly code: TransitionProblemCode;
  readonly message: string;
};

/**
 * The whole guard in one call: may a project in `from` move to `to`, with this
 * reason attached? Null means yes.
 *
 * `reason` is the normalised value — trimmed, and null rather than empty when
 * nothing was typed — because "   " must not satisfy a requirement to explain
 * yourself. Both callers that matter normalise before asking: the form through
 * `optionalText` and the data layer through its own.
 *
 * The order is the order a reader would reach the problems in. Being told the
 * reason is too long for a move that was never possible would be answering the
 * wrong question.
 */
export function checkTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  reason: string | null,
): TransitionProblem | null {
  const refusal = refuseTransition(from, to);
  if (refusal !== null) return { code: "illegal", message: refusal };

  if (reason === null && transitionRequiresReason(from, to)) {
    return {
      code: "reason-required",
      message:
        "Say why this is reopening. A closed project reopens on the record or not at all.",
    };
  }

  if (reason !== null && reason.length > TRANSITION_REASON_LIMIT) {
    return {
      code: "reason-too-long",
      message: `The reason must be ${TRANSITION_REASON_LIMIT} characters or fewer.`,
    };
  }

  return null;
}
