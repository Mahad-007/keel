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
