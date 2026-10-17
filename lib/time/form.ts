import type { NewTimeEntryInput } from "@/lib/data/time-entries";
import { formatDate, isCalendarDate } from "@/lib/dates";
import { optionalChoice } from "@/lib/forms/choice";
import { readFields } from "@/lib/forms/form-data";
import {
  collect,
  invalid,
  valid,
  type FieldErrors,
  type FieldResult,
  type ParseResult,
} from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
  type FormState,
} from "@/lib/forms/state";
import { optionalText } from "@/lib/forms/text";
import { formatMinutes, MINUTES_PER_HOUR } from "@/lib/minutes";

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

/**
 * What was logged, which is the one thing a redirecting form never needs to
 * carry.
 *
 * Logging time does not navigate. It is the act somebody performs several
 * times in a sitting — three stretches of work on a Tuesday, each a different
 * length against a different line — and a redirect per entry would reload the
 * page and throw the cursor away every time. So the form stays where it is,
 * and this is how it knows the last submission landed.
 *
 * The id is here because a live region needs its text to change for a screen
 * reader to notice it: two identical half-hours logged against the same line
 * would otherwise render the same words twice, and the second would be
 * announced to nobody.
 *
 * The rest is what the sentence afterwards has to say, and it is carried as
 * what was *written* rather than what was submitted. The duration is the
 * minutes the column holds, so a reader who typed `0.6m` is told they logged
 * a minute; the title is the line as the project has it; and the chargeable
 * flag is there because an unticked box is the easiest thing on this form to
 * get wrong by accident.
 */
export type LoggedTime = {
  readonly id: string;
  readonly minutes: number;
  readonly workedOn: string;
  /** The line it went against, or null for work on the project itself. */
  readonly deliverableTitle: string | null;
  readonly billable: boolean;
};

export type LogTimeState = LogTimeFormState & {
  readonly logged: LoggedTime | null;
};

/**
 * What the form starts from: every field empty, including the day.
 *
 * The day is filled in by the browser rather than here, for the reason
 * `workedOnDate` gives — the server does not know what today is where the
 * reader is standing.
 *
 * The box is ticked, though, and that is a decision rather than an absence.
 * Time logged against a client engagement is chargeable until somebody says
 * otherwise, which is also what the column defaults to.
 */
export const INITIAL_LOG_TIME_STATE: LogTimeState = {
  ...initialFormState({
    ...EMPTY_LOG_TIME_FIELDS,
    billable: BILLABLE_VALUE,
  }),
  logged: null,
};

/**
 * An entry was written. The form comes back ready for the next one, holding
 * the day and nothing else.
 *
 * The day is kept because it is the field most likely to be right again and
 * the most tedious to re-pick: somebody writing up Tuesday evening is writing
 * up three stretches of the same Tuesday, and resetting the date to blank
 * would make them say so three times.
 *
 * Everything else goes back to its default, because everything else is about
 * the particular stretch of work that has just been filed. A duration left in
 * the box is one press from logging the same hour twice; an attribution left
 * selected is how the next entry quietly lands on the wrong line; and the
 * checkbox goes back to ticked rather than staying as it was, so a single
 * non-chargeable entry cannot make the rest of the evening's work free
 * without anybody noticing.
 */
export function loggedTimeState(logged: LoggedTime): LogTimeState {
  return {
    ...INITIAL_LOG_TIME_STATE,
    fields: {
      ...INITIAL_LOG_TIME_STATE.fields,
      workedOn: logged.workedOn,
    },
    logged,
  };
}

/** Validation refused the submission. Nothing was written. */
export function rejectedLogTimeState(
  fields: LogTimeFormFields,
  errors: FieldErrors<LogTimeFieldName>,
): LogTimeState {
  return { ...rejectedFormState(fields, errors), logged: null };
}

/** The submission was good and nothing was written anyway. */
export function failedLogTimeState(
  fields: LogTimeFormFields,
  formError: string,
): LogTimeState {
  return { ...failedFormState(fields, formError), logged: null };
}

/**
 * The things that can stop an entry that the form itself cannot see.
 *
 * Each one is reachable from a page that was right when it rendered — the
 * project deleted in another tab, the line of scope dropped while the form sat
 * open — so each says what to do rather than only what went wrong.
 *
 * `missingDeliverable` is the second half of the message `parseLogTimeForm`
 * puts beside the picker. That one catches a line that was already gone when
 * the page was served; this one catches a line that goes between the check and
 * the write, which is the same news arriving a moment later and belongs to the
 * submission rather than to a field, because by then the picker on screen is
 * offering something that no longer exists.
 */
export const TIME_PROBLEMS = {
  missingProject:
    "That project no longer exists, so there is nothing to log time against.",
  missingDeliverable:
    "That deliverable was deleted a moment ago. Nothing was logged — reload the page and pick again, or log the time against the project itself.",
  failed: "Could not log that time. Nothing was written — try again.",
} as const;

/**
 * What to say when the submission never got an answer — the connection
 * dropped, the tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was written, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with the entry already stored. Nor does it say "try
 * again", which is the instruction that would log the same hour twice — and a
 * duplicated hour is worse here than a duplicated anything else on this page,
 * because it is money, and the invoice it reaches will be defended line by
 * line.
 */
export const LOG_TIME_NO_ANSWER =
  "Could not tell whether that time was logged — the answer never arrived. Reload and check what this project already has before logging it again.";

/**
 * What to say after an entry is logged, or null when there is nothing to say.
 *
 * The form does not navigate, so a successful submission changes the page in
 * ways a reader may be looking at none of: the boxes empty, and an entry
 * appears in a list somewhere above. Anyone working from a screen reader gets
 * no notification of either. This is the sentence that goes in a live region.
 *
 * It names all four things that were decided, because each is a thing the
 * reader could have got wrong and cannot now see. The duration is read back as
 * the column holds it — somebody who typed `90` is told they logged 1h 30m,
 * which is the one confirmation that the convention in `parseDuration` worked
 * out the way they meant. The day is named because it was prefilled by the
 * browser and may have been left as today by mistake. The line is named
 * because the picker resets after every entry, so "against the project itself"
 * is the thing a reader most often discovers one entry too late. And a
 * non-chargeable entry says so, since an unticked box is the easiest mistake
 * on this form to make and the most expensive to find out about in a month.
 */
export function loggedTimeNotice(state: LogTimeState): string | null {
  if (state.logged === null) return null;

  const { minutes, workedOn, deliverableTitle, billable } = state.logged;
  const against =
    deliverableTitle === null ? "the project itself" : `“${deliverableTitle}”`;
  const charge = billable ? "" : " Marked as not chargeable.";

  return `Logged ${formatMinutes(minutes)} on ${formatDate(workedOn)} against ${against}.${charge}`;
}
