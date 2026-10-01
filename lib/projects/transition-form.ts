import { readFields } from "@/lib/forms/form-data";
import { initialFormState, type FormState } from "@/lib/forms/state";

/**
 * The status form, from submitted strings to a move the data layer will
 * attempt. Pure, like every other form module here: it takes the fields and
 * the status the project is in, never a request or a database.
 *
 * It is a form rather than a bound action per button because of the reason.
 * Reopening a closed project has to say why, and a textarea that can be
 * rejected and re-rendered with what was typed in it is a form — anything less
 * loses the sentence the guard just demanded.
 */

/**
 * In the order the form lays them out. The buttons come first because the
 * status is the decision; the note is what you attach to it.
 */
export const TRANSITION_FIELD_NAMES = ["status", "reason"] as const;

export type TransitionFieldName = (typeof TRANSITION_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type TransitionFormFields = Record<TransitionFieldName, string>;

export const EMPTY_TRANSITION_FIELDS: TransitionFormFields = {
  status: "",
  reason: "",
};

export type TransitionFormState = FormState<TransitionFieldName>;

/**
 * What the form starts from. Defined here rather than in the action file
 * because a `"use server"` module may only export async functions.
 */
export const INITIAL_TRANSITION_FORM_STATE: TransitionFormState =
  initialFormState(EMPTY_TRANSITION_FIELDS);

/**
 * The submitted form as strings.
 *
 * `status` arrives from the pressed button's own value rather than from an
 * input, which is what lets one form offer two moves without a radio group
 * nobody would read. A form submitted some other way — scripted, or by a
 * keypress the browser did not attribute to a button — sends no status at all,
 * and reads as blank here rather than as a default move.
 */
export function readTransitionFields(formData: FormData): TransitionFormFields {
  return readFields(formData, TRANSITION_FIELD_NAMES);
}
