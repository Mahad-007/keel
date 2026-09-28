import type { NewProjectInput } from "@/lib/data/projects";
import { requiredChoice } from "@/lib/forms/choice";
import { readFields } from "@/lib/forms/form-data";
import { collect, type FieldErrors, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";
import { requiredText } from "@/lib/forms/text";

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

/**
 * What the form yields once every field is good: exactly the columns a
 * project row is made of, which the data layer accepts whole as a new project
 * or as a patch to an existing one.
 */
export type ProjectFormValue = Pick<NewProjectInput, "clientId" | "name">;

/**
 * `clientIds` is the set the form actually offered. Validating against it
 * rather than against "some row exists" is what stops a submission naming a
 * client the picker never showed — and it means the id reaching the data
 * layer has already been proven to be one of them.
 */
export function parseProjectForm(
  fields: ProjectFormFields,
  clientIds: readonly string[],
): ParseResult<ProjectFormValue, ProjectFieldName> {
  const parsed = collect({
    client: requiredChoice(fields.client, clientIds, {
      label: "Client",
      // The likeliest cause is a page left open while the client was
      // archived, not a typo, so the message says what to do about it.
      unknown: "That client is not one you can pick. Choose another.",
    }),
    name: requiredText(fields.name, {
      label: "Name",
      max: PROJECT_FIELD_LIMITS.name,
    }),
  });

  if (!parsed.ok) return parsed;

  const { client, name } = parsed.value;
  return { ok: true, value: { clientId: client, name } };
}
