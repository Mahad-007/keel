import { readFields } from "@/lib/forms/form-data";
import { initialFormState, type FormState } from "@/lib/forms/state";

/**
 * The deliverable form, from submitted strings to something the data layer
 * will accept. Pure, like every other form module here: it takes the fields
 * and nothing else — no request, no database — so every branch is testable
 * without either.
 *
 * It is one module for a form that appears in two places. Today it is the add
 * line under a project's scope list; Day 014 adds editing, which asks for the
 * same three things and has to reject them the same way. A second spelling of
 * "a title is required" is how two forms end up disagreeing about what scope
 * is allowed to say.
 */

/**
 * In the order the form lays the fields out, which is also the order errors
 * are walked in: the cursor after a rejected submission has to land on the
 * first problem the reader would reach, not the first one declared here.
 *
 * Status and position are deliberately absent. A new deliverable is pending
 * and goes on the end — both are facts about adding scope rather than
 * decisions to offer, and the data layer will not take either in a patch.
 */
export const DELIVERABLE_FIELD_NAMES = [
  "title",
  "description",
  "estimate",
] as const;

export type DeliverableFieldName = (typeof DELIVERABLE_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type DeliverableFormFields = Record<DeliverableFieldName, string>;

/**
 * How long each field may be. Exported because the inputs carry the same
 * numbers as `maxLength`: two copies of "120" drift, and the day they do the
 * browser stops someone at a length the validator would have accepted, or
 * lets them type past one it rejects.
 */
export const DELIVERABLE_FIELD_LIMITS = {
  /** A line of a scope list is a title, not the paragraph under it. */
  title: 120,
  /** Room for the detail that decides an argument, short of a brief. */
  description: 2000,
} as const;

export const EMPTY_DELIVERABLE_FIELDS: DeliverableFormFields = {
  title: "",
  description: "",
  estimate: "",
};

export type DeliverableFormState = FormState<DeliverableFieldName>;

/**
 * What the form starts from. Defined here rather than in the action file
 * because a `"use server"` module may only export async functions.
 */
export const INITIAL_DELIVERABLE_FORM_STATE: DeliverableFormState =
  initialFormState(EMPTY_DELIVERABLE_FIELDS);

export function readDeliverableFields(
  formData: FormData,
): DeliverableFormFields {
  return readFields(formData, DELIVERABLE_FIELD_NAMES);
}
