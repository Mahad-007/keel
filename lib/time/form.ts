import { readFields } from "@/lib/forms/form-data";
import type { FormState } from "@/lib/forms/state";

/**
 * The log-time form, from submitted strings to something the data layer will
 * accept. Pure, like every other form module here: fields in, result out, no
 * request and no database.
 *
 * Five things, and only two of them are required. Logging time is the act this
 * product asks somebody to perform several times a day, every day, for as long
 * as they use it — so the cost of the form is the whole feature. A form that
 * demands a note and an attribution is a form that gets filled in for a week;
 * what is actually required is the pair that makes an entry mean anything at
 * all, which is how long and which day.
 */

/**
 * In the order the form lays the fields out, which is also the order errors
 * are walked in: the cursor after a rejected submission has to land on the
 * first problem the reader would reach on screen, not the first one declared
 * here.
 *
 * The duration leads because it is the thing being logged, and it shares its
 * row with the day. The attribution comes next, then the note under both of
 * them, then the checkbox — which is last because it is the one field that
 * already holds the right answer for almost every entry.
 */
export const LOG_TIME_FIELD_NAMES = [
  "duration",
  "workedOn",
  "deliverable",
  "note",
  "billable",
] as const;

export type LogTimeFieldName = (typeof LOG_TIME_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type LogTimeFormFields = Record<LogTimeFieldName, string>;

/**
 * How long the fields that hold text may be. Exported because the inputs carry
 * the same numbers as their `maxLength`: two copies of a limit drift, and the
 * day they do the browser stops somebody at a length the validator would have
 * accepted.
 *
 * A note is shorter than a deliverable's description by a lot, and
 * deliberately. A description is the detail behind a thing that was agreed,
 * which an argument may one day turn on; a note is what was done this
 * afternoon, written in a hurry, and read back in a list of forty of them. The
 * limit is the shape of the field as much as a ceiling on it.
 */
export const LOG_TIME_FIELD_LIMITS = {
  note: 500,
} as const;

/**
 * What the form starts from, and what it comes back to after a day's first
 * entry.
 *
 * The day is blank rather than today, which is the one thing this module
 * cannot decide: `workedOn` is a calendar date and the only clock that knows
 * which day the reader means is the one in front of them. The form fills it in
 * from the browser — see `localCalendarDate` — and a blank here is what tells
 * it there is nothing to preserve.
 */
export const EMPTY_LOG_TIME_FIELDS: LogTimeFormFields = {
  duration: "",
  workedOn: "",
  deliverable: "",
  note: "",
  billable: "",
};

export type LogTimeFormState = FormState<LogTimeFieldName>;

export function readLogTimeFields(formData: FormData): LogTimeFormFields {
  return readFields(formData, LOG_TIME_FIELD_NAMES);
}
