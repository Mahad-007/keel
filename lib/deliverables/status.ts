/**
 * A deliverable's status is how a scope list says what is left.
 *
 * Three values, and the middle one earns its place: a list that only knows
 * "done" and "not done" cannot tell a deliverable nobody has touched from one
 * that has had a week poured into it, and that difference is the whole signal
 * the scope-creep work later in the roadmap reads. High burn against a pile of
 * untouched scope is the shape of a project in trouble.
 *
 * The values live here rather than inline in the schema so the column, the
 * forms, and the labels are all reading one list. Order is the order work
 * moves through them.
 */
export const DELIVERABLE_STATUSES = ["pending", "started", "done"] as const;

export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

/**
 * What a deliverable is when it is first written down. Agreeing scope is not
 * starting it, so a new row is pending however confident everyone is.
 */
export const DEFAULT_DELIVERABLE_STATUS: DeliverableStatus = "pending";

/**
 * Narrows an unknown string — a form field, a URL param, a column read back
 * from a row written before a status was renamed — to a deliverable status.
 * The caller decides whether anything else is a default or an error.
 */
export function isDeliverableStatus(value: unknown): value is DeliverableStatus {
  return (
    typeof value === "string" &&
    (DELIVERABLE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * The strict form, for callers with nowhere sensible to fall back to — the
 * data layer writing the column. The message lists the alternatives, because
 * the usual cause is a typo and the usual reader is a developer.
 */
export function parseDeliverableStatus(value: unknown): DeliverableStatus {
  if (!isDeliverableStatus(value)) {
    throw new Error(
      `unknown deliverable status: ${JSON.stringify(value)} (expected one of ${DELIVERABLE_STATUSES.join(", ")})`,
    );
  }
  return value;
}

/**
 * How each status is written in the UI. A record rather than a capitalisation
 * of the stored value, so the column names and the words a person reads can
 * move independently — and so adding a status without deciding what to call it
 * fails to compile.
 *
 * "Not started" rather than "Pending", because pending is what a reader has to
 * translate: it says a state, where the other two say what happened to the
 * work. The three labels only make sense as a set.
 */
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: "Not started",
  started: "In progress",
  done: "Done",
};

/**
 * The label for a status, falling back to the stored value itself.
 *
 * The column is plain TEXT in SQLite, so the three values are a type-level
 * promise a hand-edited row can break. Without the fallback such a row renders
 * an empty cell, which reads as missing data; showing the raw value says what
 * is actually in the database.
 */
export function deliverableStatusLabel(status: DeliverableStatus): string {
  return DELIVERABLE_STATUS_LABELS[status] ?? status;
}

/**
 * Where one press of a deliverable's status button lands it.
 *
 * A cycle rather than a forward control and a back one. Three statuses need at
 * most two presses to reach any of the others, so a second button would buy
 * nothing and cost a column in every row of the list — and the label says the
 * destination, so a press is never a guess about which way round the loop
 * goes. The loop closing is what makes a mis-press cheap: nothing in a scope
 * list is a dead end you have to go and edit a row to escape.
 *
 * A status the list does not know — the column is plain TEXT, so a hand-edited
 * row can hold one — rejoins the cycle at the start rather than staying stuck
 * outside it. Pressing the button on such a row is the only way back, and
 * "not started" is the one status that is true of a deliverable nobody can say
 * anything about.
 */
export function nextDeliverableStatus(
  status: DeliverableStatus,
): DeliverableStatus {
  const held = DELIVERABLE_STATUSES.indexOf(status);
  if (held === -1) return DEFAULT_DELIVERABLE_STATUS;
  return DELIVERABLE_STATUSES[(held + 1) % DELIVERABLE_STATUSES.length];
}

/**
 * What the status button says, keyed by the status the deliverable is in now.
 *
 * Keyed by where it is rather than where it is going, because that is what the
 * row knows and because the verb is about the work rather than the column:
 * "Mark done" is a thing a person does to a deliverable, where "Done" would be
 * a label pretending to be a control. The three only make sense as a set — each
 * one has to be unmistakable next to a line of scope, and none of them may read
 * as the status the row already shows.
 *
 * "Reopen" lands on not-started rather than back in progress. A deliverable
 * that is no longer done is not thereby being worked on, and saying so is one
 * more press — which is the right price for not inventing a fact about
 * somebody's week.
 */
export const DELIVERABLE_STATUS_VERBS: Record<DeliverableStatus, string> = {
  pending: "Start",
  started: "Mark done",
  done: "Reopen",
};

/**
 * What to put on the status button for a deliverable in this status.
 *
 * The fallback matches what `nextDeliverableStatus` does with a status the list
 * does not know: such a row goes back to not-started, and the button has to say
 * that rather than offer a verb for a state nobody can interpret.
 */
export function deliverableStatusVerb(status: DeliverableStatus): string {
  return DELIVERABLE_STATUS_VERBS[status] ?? "Reset status";
}

/**
 * How each status reads inside a sentence about the deliverable, rather than as
 * a label in a column.
 *
 * The list changes under the reader without the page reloading — a press sets a
 * status, and the only thing that moves is two words on one line. That is
 * nothing at all to anyone working from a screen reader, so the change is said
 * out loud, and a sentence needs its words in the order a sentence has them:
 * "is now in progress", not "is now In progress".
 *
 * Not-started says more than the label does, because it is the one status a
 * press can go *back* to. "is now not started" invites the reading that the
 * press undid itself; naming the list is what makes it a destination.
 */
export const DELIVERABLE_STATUS_PHRASES: Record<DeliverableStatus, string> = {
  pending: "back on the list as not started",
  started: "in progress",
  done: "done",
};

/**
 * How to say a status in a sentence, falling back to the stored value for the
 * same reason the label does: a hand-edited row should read as whatever is
 * actually in the column rather than trail off into nothing.
 */
export function deliverableStatusPhrase(status: DeliverableStatus): string {
  return DELIVERABLE_STATUS_PHRASES[status] ?? status;
}
