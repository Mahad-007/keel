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
