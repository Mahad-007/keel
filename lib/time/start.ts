import { readField, readFields } from "@/lib/forms/form-data";
import { type FormState } from "@/lib/forms/state";

import { LOG_TIME_FIELD_LIMITS } from "./form";

/**
 * The form that starts a clock, from submitted strings to something the data
 * layer will accept. Pure, like every other form module here.
 *
 * Three fields, and none of them is required. That is the whole design of it:
 * the press has to be as close to free as a press can be, because a timer that
 * takes a form to start is a timer nobody starts — they do the work and write
 * it up later from memory, which is the thing this milestone exists to replace.
 *
 * So there is no duration, because a running clock has none yet, and no day
 * field, because the day is a fact about when Start was pressed rather than a
 * decision. What is left is the three things worth saying in advance: which
 * line of scope the work is going into, what the work is, and whether it is
 * chargeable. All three can be corrected afterwards on the entry the clock
 * becomes, which is why none of them blocks the press.
 */

/**
 * In the order the form lays them out, which is also the order errors are
 * walked in: the cursor after a rejected submission has to land on the first
 * problem the reader would reach on screen.
 *
 * `startedOn` is deliberately not among them. It is a hidden field carrying
 * the browser's own date, so a reader never typed it and there is no box to
 * put a message under — a problem with it belongs to the submission as a
 * whole. See `readTimerStartDay`.
 */
export const START_TIMER_FIELD_NAMES = [
  "deliverable",
  "note",
  "billable",
] as const;

export type StartTimerFieldName = (typeof START_TIMER_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type StartTimerFormFields = Record<StartTimerFieldName, string>;

/**
 * The name the browser's own date is submitted under.
 *
 * Its own constant rather than a member of the field list above, because it is
 * not a field in the sense the others are: nothing labels it, nothing can
 * focus it, and nothing renders a message beside it.
 */
export const STARTED_ON_FIELD = "startedOn";

/**
 * How long the note may be — the log form's limit, because it is the same
 * note. A clock started with a note and a stretch of work typed up with one
 * produce the same column, and two limits on one column is one of them being
 * wrong.
 */
export const START_TIMER_FIELD_LIMITS = LOG_TIME_FIELD_LIMITS;

/** What the form starts from: no line picked, no note, chargeable. */
export const EMPTY_START_TIMER_FIELDS: StartTimerFormFields = {
  deliverable: "",
  note: "",
  billable: "",
};

export type StartTimerFormState = FormState<StartTimerFieldName>;

export function readStartTimerFields(
  formData: FormData,
): StartTimerFormFields {
  return readFields(formData, START_TIMER_FIELD_NAMES);
}

/** The day the browser says it is, as the hidden field carries it. */
export function readStartTimerDay(formData: FormData): string {
  return readField(formData, STARTED_ON_FIELD);
}
