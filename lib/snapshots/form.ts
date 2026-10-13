import { readFields } from "@/lib/forms/form-data";
import type { FormState } from "@/lib/forms/state";

/**
 * The form that takes a snapshot of a project's scope, from submitted strings
 * to something the data layer will accept.
 *
 * One field, and it is optional. What gets recorded is the scope list as it
 * stands at the moment of the press — the form is not where lines are chosen,
 * because a form that asked you to tick eight boxes would be a form that could
 * record something other than what was agreed, which is the one thing a
 * snapshot must not do. So the only thing asked for is what to call the moment.
 *
 * Pure, like every other form module here: fields in, result out, no request
 * and no database.
 */

/**
 * The fields, in the order the form lays them out — which is the order errors
 * are walked in, so the cursor after a rejected submission lands on the first
 * problem a reader would reach on screen. There is one of them today, and the
 * list is still the thing the focus hook is driven by.
 */
export const SNAPSHOT_FIELD_NAMES = ["label"] as const;

export type SnapshotFieldName = (typeof SNAPSHOT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type SnapshotFormFields = Record<SnapshotFieldName, string>;

/**
 * How long the label may be. Exported because the input carries the same
 * number as its `maxLength`: two copies of a limit drift, and the day they do
 * the browser stops somebody at a length the validator would have accepted.
 *
 * Shorter than a template's name, because a label is read in a picker beside a
 * date and a size — "Signed proposal" is the shape of the thing, not a
 * sentence about why it was taken.
 */
export const SNAPSHOT_LABEL_LIMIT = 80;

/**
 * Which form these fields belong to, for the ids they render under.
 *
 * The scope tab holds several forms at once, and the focus hook and the
 * controls have to agree on the scope exactly: a form whose controls are
 * namespaced and whose hook is not puts the cursor in somebody else's box,
 * which is worse than not moving it at all.
 */
export const SNAPSHOT_FIELD_SCOPE = "snapshot";

export const EMPTY_SNAPSHOT_FIELDS: SnapshotFormFields = { label: "" };

export type SnapshotFormState = FormState<SnapshotFieldName>;

export function readSnapshotFields(formData: FormData): SnapshotFormFields {
  return readFields(formData, SNAPSHOT_FIELD_NAMES);
}
