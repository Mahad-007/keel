import type { NewActiveTimerInput } from "@/lib/data/active-timers";
import { isCalendarDate } from "@/lib/dates";
import { optionalChoice } from "@/lib/forms/choice";
import { readField, readFields } from "@/lib/forms/form-data";
import { collect, type FieldErrors } from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
  type FormState,
} from "@/lib/forms/state";
import { optionalText } from "@/lib/forms/text";

import { BILLABLE_VALUE, LOG_TIME_FIELD_LIMITS, readsAsBillable } from "./form";

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

export function readStartTimerFields(formData: FormData): StartTimerFormFields {
  return readFields(formData, START_TIMER_FIELD_NAMES);
}

/** The day the browser says it is, as the hidden field carries it. */
export function readStartTimerDay(formData: FormData): string {
  return readField(formData, STARTED_ON_FIELD);
}

/**
 * What checking a Start submission comes to.
 *
 * Three outcomes rather than two, because this form has a problem that belongs
 * to no field: the hidden date. A `ParseResult` can only report per-field
 * messages, and there is no field for a reader to look at — so the third case
 * carries one sentence for the form itself.
 */
export type StartTimerParseResult =
  | { readonly ok: true; readonly value: StartTimerFormValue }
  | {
      readonly ok: false;
      /** One message per bad field, keyed by the field's form name. */
      readonly errors: FieldErrors<StartTimerFieldName>;
      /** The sentence for the form as a whole, or null when every
       * problem belongs to a field. */
      readonly problem: string | null;
    };

/**
 * What the form yields once every field is good: the four columns a running
 * timer is made of that a person decides.
 *
 * `projectId` is not among them, for the reason it is absent from
 * `LogTimeFormValue`: the project comes from the page the form was served
 * for — captured by a server closure, encrypted — so no field of the
 * submission names the engagement a clock is started against.
 */
export type StartTimerFormValue = Pick<
  NewActiveTimerInput,
  "deliverableId" | "note" | "billable" | "startedOn"
>;

/**
 * What the picker says when a submission names a line the project does not
 * have, on the form that starts a clock.
 *
 * The instruction is the half that belongs to this form rather than to the log
 * line's: nothing has been timed yet, so the way past the refusal is to start
 * the clock against the project instead and attribute the entry afterwards.
 */
export const START_TIMER_UNKNOWN_DELIVERABLE =
  "That deliverable is no longer on this project. Reload the page and pick again, or start the clock against the project itself.";

/**
 * What to say when the hidden date did not arrive, or did not arrive as a
 * date.
 *
 * It is a form-level problem rather than a field error because the reader did
 * not type it: the field is filled in from the browser's clock after the page
 * mounts, so an empty one means the script did not run and a malformed one
 * means the submission did not come from this page. Either way there is no box
 * to put a message beside.
 *
 * It says to reload rather than to try again, because pressing the same button
 * on the same page would send the same empty field.
 */
export const START_TIMER_NO_DAY =
  "Could not tell what day it is where you are, so no clock was started. Reload the page and press Start again.";

/**
 * The submitted form, checked against the deliverables that were on offer.
 *
 * The attribution goes through `optionalChoice` for the reason the log form's
 * does: a form is a POST endpoint, and the id in it can name a line deleted
 * while the page sat open or one belonging to another project entirely. The
 * data layer throws on the second outright — it is not a mistake a reader can
 * make — and checking here means the first comes back as a sentence beside the
 * field instead of as a failed write.
 *
 * The day is collected with the fields even though it is not one of them, so a
 * submission missing it is refused before anything is written. Its message
 * lands on the form rather than on a field, which `parseStartTimerForm`
 * reports by returning it separately.
 *
 * The checkbox is not collected, because it cannot fail: a checkbox submits
 * one of two things and both are answers. It would only occupy a slot in the
 * error map that nothing could ever fill.
 */
export function parseStartTimerForm(
  fields: StartTimerFormFields,
  day: string,
  offeredDeliverableIds: readonly string[],
): StartTimerParseResult {
  const started = day.trim();
  if (!isCalendarDate(started)) {
    return { ok: false, errors: {}, problem: START_TIMER_NO_DAY };
  }

  const parsed = collect({
    deliverable: optionalChoice(fields.deliverable, offeredDeliverableIds, {
      label: "Deliverable",
      unknown: START_TIMER_UNKNOWN_DELIVERABLE,
    }),
    note: optionalText(fields.note, {
      label: "Note",
      max: START_TIMER_FIELD_LIMITS.note,
    }),
  });
  if (!parsed.ok) return { ...parsed, problem: null };

  return {
    ok: true,
    value: {
      deliverableId: parsed.value.deliverable,
      note: parsed.value.note,
      billable: readsAsBillable(fields.billable),
      startedOn: started,
    },
  };
}

/**
 * What a started clock is, for the sentence said out loud afterwards.
 *
 * The id is here because a live region needs its text to change for a screen
 * reader to notice it: two clocks started against the same line in a sitting
 * would otherwise render the same words twice, and the second would be
 * announced to nobody.
 *
 * The rest is what was decided by the press and is now out of sight. The line
 * is named because the picker is gone once the clock is running, and the
 * chargeable flag because an unticked box is the easiest thing on this form to
 * get wrong — and the most expensive to discover a month later.
 */
export type StartedTimer = {
  readonly id: string;
  /** The line it is running against, or null for the project itself. */
  readonly deliverableTitle: string | null;
  readonly billable: boolean;
};

export type StartTimerState = StartTimerFormState & {
  readonly started: StartedTimer | null;
};

/**
 * What the form starts from: no line picked, no note, and the box ticked.
 *
 * The tick is a decision rather than an absence. Time against a client
 * engagement is chargeable until somebody says otherwise, which is also what
 * the column defaults to.
 */
export const INITIAL_START_TIMER_STATE: StartTimerState = {
  ...initialFormState({
    ...EMPTY_START_TIMER_FIELDS,
    billable: BILLABLE_VALUE,
  }),
  started: null,
};

/**
 * A clock is running. The form goes back to its defaults underneath, because
 * what comes next is the panel for the running timer rather than the form.
 */
export function startedTimerState(started: StartedTimer): StartTimerState {
  return { ...INITIAL_START_TIMER_STATE, started };
}

/** Validation refused the press. No clock was started. */
export function rejectedStartTimerState(
  fields: StartTimerFormFields,
  errors: FieldErrors<StartTimerFieldName>,
): StartTimerState {
  return { ...rejectedFormState(fields, errors), started: null };
}

/** The press was good and no clock was started anyway. */
export function failedStartTimerState(
  fields: StartTimerFormFields,
  formError: string,
): StartTimerState {
  return { ...failedFormState(fields, formError), started: null };
}

/**
 * The things that can stop a clock being started that the form itself cannot
 * see.
 *
 * Each is reachable from a page that was right when it rendered — the project
 * deleted in another tab, the line of scope dropped while the form sat open, a
 * clock started on a phone a minute ago — so each says what to do rather than
 * only what went wrong.
 *
 * `alreadyRunning` is not here because it needs a project's name, which is a
 * sentence rather than a constant. See `timerAlreadyRunning`.
 */
export const START_TIMER_PROBLEMS = {
  missingProject:
    "That project no longer exists, so there is nothing to start a clock on.",
  missingDeliverable:
    "That deliverable was deleted a moment ago. No clock was started — reload the page and pick again, or start it against the project itself.",
  failed: "Could not start the clock. Nothing was written — try again.",
} as const;

/**
 * What to say when a clock is already running somewhere.
 *
 * It names the project, which is the whole of what the reader needs: the clock
 * they have forgotten about is almost always on the engagement they were doing
 * before this one, and a refusal that does not say where sends somebody
 * through their project list looking for it.
 *
 * The instruction is to stop that one rather than offering to do it from here.
 * Stopping a clock writes a stretch of work against a project, and doing that
 * as a side effect of starting a different one is the one press on this page
 * that must not be implicit.
 */
export function timerAlreadyRunning(projectName: string): string {
  return `A clock is already running on ${projectName}, and only one can run at a time. Stop that one first — nobody works on two things at once, and two clocks would make every figure a question about which was meant.`;
}

/**
 * What to say when the press never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was started, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with the clock already running. Nor does it say "try
 * again", which on this press is the instruction that produces the refusal
 * above and leaves a reader thinking they have two clocks.
 */
export const START_TIMER_NO_ANSWER =
  "Could not tell whether the clock started — the answer never arrived. Reload to see whether it is running before pressing Start again.";
