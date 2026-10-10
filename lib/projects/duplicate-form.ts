import { readFields } from "@/lib/forms/form-data";
import { type FormState } from "@/lib/forms/state";

/**
 * The form that copies a project, from submitted strings to something the
 * data layer will accept.
 *
 * One field, and it is not any of the ones being copied. What crosses over is
 * decided by `duplicate.ts` and is not up for negotiation at the moment of the
 * press: a form offering checkboxes for the client, the value and the rate
 * would be the new-project form with extra steps, and the whole value of
 * duplication is not having to fill that in again. So the only thing asked for
 * is the one thing a copy cannot inherit — what to call it.
 *
 * Pure, like every other form module here: fields in, result out, no request
 * and no database.
 */

/**
 * The one field, as a list, because the reader, the validator and the focus
 * hook all take the same list — and a second field added later has to appear
 * in the order the form lays them out rather than wherever it was declared.
 */
export const DUPLICATE_FIELD_NAMES = ["name"] as const;

export type DuplicateFieldName = (typeof DUPLICATE_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type DuplicateFormFields = Record<DuplicateFieldName, string>;

/**
 * Which form these fields belong to, for the ids they render under.
 *
 * The overview tab already holds the status form, and both forms sit on one
 * page, so the ids are namespaced for the reason `fieldId` gives: two controls
 * with one id is a label that focuses the wrong box. Nothing clashes today —
 * the other form asks for a reason — and that is exactly the kind of thing
 * that stops being true when a field is added.
 */
export const DUPLICATE_FIELD_SCOPE = "duplicate";

export const EMPTY_DUPLICATE_FIELDS: DuplicateFormFields = { name: "" };

export type DuplicateFormState = FormState<DuplicateFieldName>;

export function readDuplicateFields(formData: FormData): DuplicateFormFields {
  return readFields(formData, DUPLICATE_FIELD_NAMES);
}
