import type { NewTimeEntryInput } from "@/lib/data/time-entries";
import { isCalendarDate } from "@/lib/dates";
import { optionalChoice } from "@/lib/forms/choice";
import { readFields } from "@/lib/forms/form-data";
import {
  collect,
  invalid,
  valid,
  type FieldResult,
  type ParseResult,
} from "@/lib/forms/result";
import type { FormState } from "@/lib/forms/state";
import { optionalText } from "@/lib/forms/text";
import { MINUTES_PER_HOUR } from "@/lib/minutes";

import { parseDuration, type DurationReason } from "./duration";

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

/**
 * The longest a single entry can be: one day.
 *
 * Not a judgement about how long anybody should work — twelve hours is a
 * judgement, and Day 030 is where that belongs, as something flagged rather
 * than refused. This is arithmetic: an entry is a stretch of work on one
 * calendar day, and a stretch longer than the day it is filed under did not
 * happen on that day.
 *
 * What it actually catches is the typo that matters — `40h` for `40m`, a
 * slipped zero — where the figure is sixty times too big and poisons every
 * burn number derived from it. Twenty-four is the ceiling that refuses those
 * without arguing with anyone's hours.
 */
export const MAX_ENTRY_MINUTES = 24 * MINUTES_PER_HOUR;

/**
 * What to say about a duration that could not be read, one sentence per
 * reason.
 *
 * Every one of them names a spelling that works, because the field has a
 * syntax and a reader who got it wrong has no way of knowing what the syntax
 * is. "That is not a valid duration" is the message that makes somebody try
 * the same thing again in a different order.
 *
 * Exhaustive by its type, so a reason added to the parser is a compile error
 * here rather than a blank message under a red box.
 */
export const DURATION_MESSAGES: Record<DurationReason, string> = {
  blank: "Say how long it took — 1h30m, 45m, or 90 for ninety minutes.",
  "bare-fraction":
    "A fraction on its own could be minutes or hours. Write 1.5h for an hour and a half, or 90 for ninety minutes.",
  comma: "Write the fraction with a point rather than a comma: 1.5h, not 1,5h.",
  clock:
    "Write how long it took rather than a clock reading: 1h30m or 90, not 1:30.",
  unreadable:
    "That is not a length of time. Write it as 1h30m, 45m, or 90 for ninety minutes.",
};

/** What a duration outside the readable range is told, in minutes and hours. */
const MAX_ENTRY_HOURS = MAX_ENTRY_MINUTES / MINUTES_PER_HOUR;

/**
 * How long the work took, as whole minutes.
 *
 * Three refusals on top of the parser's, and each is a different thing to
 * tell the reader. Zero is a field that was filled in and says nothing
 * happened — the column refuses it, and an entry of no minutes is a row every
 * later reading of the table has to skip. A negative is a typed minus sign,
 * which is a slip rather than a syntax error, so it gets a sentence of its own
 * rather than being lumped in with what cannot be read. And past a day it is
 * the figure that is wrong, not the spelling.
 */
export function loggedMinutes(value: string): FieldResult<number> {
  const parsed = parseDuration(value);
  if (!parsed.ok) return invalid(DURATION_MESSAGES[parsed.reason]);

  const minutes = parsed.minutes;
  if (minutes < 0) {
    return invalid(
      "Time logged cannot be negative — say how long the work took.",
    );
  }
  if (minutes === 0) {
    return invalid(
      "That rounds to no time at all. An entry has to be at least a minute long.",
    );
  }
  if (minutes > MAX_ENTRY_MINUTES) {
    return invalid(
      `One entry cannot be longer than ${MAX_ENTRY_HOURS} hours — it is one day's work on one project. Split a longer stretch across the days it was worked.`,
    );
  }
  return valid(minutes);
}

/**
 * The day the work was done on, as the `YYYY-MM-DD` the column holds.
 *
 * Required, with no default anywhere on the server side. "Today" is a
 * timezone decision dressed up as a convenience — the server may be most of a
 * day away from the person logging — so the field arrives prefilled from the
 * browser's own clock and this only has to check what came back.
 *
 * A date input submits the right shape or nothing at all, so the second
 * message is for the submission that did not come from one: a browser without
 * the input type, a form posted directly. It says what the field wants rather
 * than what was wrong with it, which is the only useful thing to say to
 * somebody typing into a plain box.
 *
 * Nothing here looks at whether the day is in the future or implausibly far
 * back. Both are readable dates that somebody could mean — a holiday logged
 * on return, a correction to last quarter — and the ones that are mistakes are
 * better flagged against the entries around them than refused one at a time
 * by a form with no clock of its own.
 */
export function workedOnDate(value: string): FieldResult<string> {
  const trimmed = value.trim();
  if (trimmed === "") {
    return invalid("Say which day the work was done on.");
  }
  if (!isCalendarDate(trimmed)) {
    return invalid(
      "Write the day as a date, like 2026-10-17 — the day the work was done on, not the time it started.",
    );
  }
  return valid(trimmed);
}

/**
 * What the chargeable checkbox submits when it is ticked.
 *
 * An explicit value rather than the browser's default `on`, because the
 * default is a word with no meaning that both the input and the reader of this
 * module have to remember. Exported so the input and the check cannot drift
 * into disagreeing about it — a checkbox submitting `on` against a check for
 * `yes` would quietly mark every entry non-billable.
 */
export const BILLABLE_VALUE = "yes";

/**
 * Whether the submission says this time is chargeable.
 *
 * A checkbox submits its value when ticked and nothing at all when not, so
 * "absent" is how a browser says no. That makes the reading strict: only the
 * exact value counts, and everything else — blank, `on`, `false`, `true` —
 * reads as not chargeable.
 *
 * Strict in that direction on purpose. A loose reading would take any value as
 * yes, so a submission carrying `billable=false` would bill the time, which is
 * the one mistake the column exists to prevent: an hour somebody marked
 * non-chargeable and got charged for is on a document a client has been sent.
 * The other way round, an hour wrongly left out of an invoice is still in the
 * list, still unbilled, and still billable tomorrow.
 */
export function readsAsBillable(value: string): boolean {
  return value === BILLABLE_VALUE;
}

/**
 * What the form yields once every field is good: exactly the columns a time
 * entry is made of that a person decides.
 *
 * `projectId` is not among them, and that is the one thing about this type
 * worth saying twice. The project comes from the page the form was served
 * for — captured by a server closure, encrypted — so no field of the
 * submission names the engagement an hour gets billed to.
 */
export type LogTimeFormValue = Pick<
  NewTimeEntryInput,
  "minutes" | "note" | "workedOn" | "billable" | "deliverableId"
>;

/**
 * The submitted form, checked against the deliverables that were on offer.
 *
 * The attribution is checked against the list rather than trusted, for the
 * reason every picker in the app is: a form is a POST endpoint, and the id in
 * it can name a line deleted while the page sat open, or one belonging to
 * another project entirely. The data layer refuses the second outright — it is
 * not a mistake a reader can make — and checking here means the first comes
 * back as a sentence beside the field instead of as a failed write.
 *
 * The checkbox is not collected with the others because it cannot fail: a
 * checkbox submits one of two things, and both of them are answers. It would
 * only ever occupy a slot in the error map that nothing could ever fill.
 */
export function parseLogTimeForm(
  fields: LogTimeFormFields,
  offeredDeliverableIds: readonly string[],
): ParseResult<LogTimeFormValue, LogTimeFieldName> {
  const parsed = collect({
    duration: loggedMinutes(fields.duration),
    workedOn: workedOnDate(fields.workedOn),
    deliverable: optionalChoice(fields.deliverable, offeredDeliverableIds, {
      label: "Deliverable",
      unknown:
        "That deliverable is no longer on this project. Reload the page and pick again, or log the time against the project itself.",
    }),
    note: optionalText(fields.note, {
      label: "Note",
      max: LOG_TIME_FIELD_LIMITS.note,
    }),
  });

  if (!parsed.ok) return parsed;

  const { duration, workedOn, deliverable, note } = parsed.value;
  return {
    ok: true,
    value: {
      minutes: duration,
      workedOn,
      deliverableId: deliverable,
      note,
      billable: readsAsBillable(fields.billable),
    },
  };
}
