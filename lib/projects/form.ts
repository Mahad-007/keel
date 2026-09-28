import { readFields } from "@/lib/forms/form-data";
import { initialFormState, type FormState } from "@/lib/forms/state";
import type { FieldErrors } from "@/lib/forms/result";

/**
 * The project form, from submitted strings to something the data layer will
 * accept. Pure: it takes the fields and the clients on offer, never a request
 * or a database, so every validation branch is testable without either.
 *
 * The field names are the single source of truth — the inputs, the reader,
 * the validators, and the error keys all come from this list, so a renamed
 * input cannot quietly stop being validated.
 */

/**
 * In the order the form lays the fields out, which is also the order errors
 * are walked in: the cursor after a rejected submission has to land on the
 * first problem the user would read, not the first one declared here.
 *
 * The client comes first because it is the decision the rest of the form is
 * relative to — the rate override field is only meaningful once you know
 * whose default it would be overriding.
 *
 * Status is deliberately absent. A project's status moves through a lifecycle
 * with rules of its own, and a `<select>` on an edit form would let a closed
 * project silently reopen; Day 010 gives it the transitions it needs.
 */
export const PROJECT_FIELD_NAMES = [
  "client",
  "name",
  "contractValue",
  "rateOverride",
] as const;

export type ProjectFieldName = (typeof PROJECT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type ProjectFormFields = Record<ProjectFieldName, string>;

export type ProjectFieldErrors = FieldErrors<ProjectFieldName>;

/**
 * How long each field may be. Exported because the inputs carry the same
 * numbers as `maxLength`: two copies of "120" drift, and the day they do the
 * browser stops someone at a length the validator would have accepted, or
 * lets them type past one it rejects.
 */
export const PROJECT_FIELD_LIMITS = {
  /** A project name is a title, not a description. The same ceiling as a client's. */
  name: 120,
} as const;

export const EMPTY_PROJECT_FIELDS: ProjectFormFields = {
  client: "",
  name: "",
  contractValue: "",
  rateOverride: "",
};

export type ProjectFormState = FormState<ProjectFieldName>;

/**
 * What the form starts from. Defined here rather than in the action file
 * because a `"use server"` module may only export async functions.
 */
export const INITIAL_PROJECT_FORM_STATE: ProjectFormState =
  initialFormState(EMPTY_PROJECT_FIELDS);

export function readProjectFields(formData: FormData): ProjectFormFields {
  return readFields(formData, PROJECT_FIELD_NAMES);
}
