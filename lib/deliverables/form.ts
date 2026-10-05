import type { NewDeliverableInput } from "@/lib/data/deliverables";
import { optionalEstimateMinutes } from "@/lib/forms/estimate";
import { readFields } from "@/lib/forms/form-data";
import {
  collect,
  type FieldErrors,
  type ParseResult,
} from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
  type FormState,
} from "@/lib/forms/state";
import { optionalText, requiredText } from "@/lib/forms/text";

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

/**
 * What the form yields once every field is good: exactly the columns a
 * deliverable row is made of that a person decides, which the data layer
 * accepts whole as a new deliverable or as a patch to an existing one.
 */
export type DeliverableFormValue = Pick<
  NewDeliverableInput,
  "title" | "description" | "estimatedMinutes"
>;

/**
 * The submitted form, checked.
 *
 * The title is the only thing required, and that is the whole shape of the
 * form: a scope list is worth having with three bare lines on it, and
 * demanding an estimate before one can be written down is how a list stops
 * getting written down. The estimate is the number this product exists to
 * compare against, so it is asked for — but a blank one is zero, and zero
 * reads as "not estimated yet" wherever it is shown.
 */
export function parseDeliverableForm(
  fields: DeliverableFormFields,
): ParseResult<DeliverableFormValue, DeliverableFieldName> {
  const parsed = collect({
    title: requiredText(fields.title, {
      label: "Title",
      max: DELIVERABLE_FIELD_LIMITS.title,
    }),
    description: optionalText(fields.description, {
      label: "Description",
      max: DELIVERABLE_FIELD_LIMITS.description,
    }),
    estimate: optionalEstimateMinutes(fields.estimate),
  });

  if (!parsed.ok) return parsed;

  const { title, description, estimate } = parsed.value;
  return {
    ok: true,
    value: { title, description, estimatedMinutes: estimate },
  };
}

/**
 * What the add line hands back, which is a form state plus one thing a
 * redirecting form never needs: what was just added.
 *
 * Adding scope does not navigate. The reader is working down a list of things
 * they agreed to and typing them in one after another, and a redirect per
 * line would throw the cursor away every time. So the form stays where it is,
 * and this is how it knows the last submission succeeded.
 *
 * The row rather than a boolean, for two reasons. The sentence worth saying
 * afterwards names what landed — and the id tells two adds apart that say the
 * same thing. A scope list can hold "Revision round" twice, and without the
 * id the second one is indistinguishable from the first, which matters to a
 * live region: its content has to change for a screen reader to notice it.
 */
export type AddedDeliverable = {
  readonly id: string;
  readonly title: string;
};

export type AddDeliverableState = DeliverableFormState & {
  readonly added: AddedDeliverable | null;
};

export const INITIAL_ADD_DELIVERABLE_STATE: AddDeliverableState = {
  ...INITIAL_DELIVERABLE_FORM_STATE,
  added: null,
};

/**
 * Adding a deliverable, with the project already bound — what the form at the
 * bottom of a scope list is handed, rather than a project id to pass on.
 *
 * `useActionState` wants an action it can call, and the obvious way to give it
 * one is `.bind` — which does not do what it looks like. Bound arguments are
 * concatenated onto the reference and serialised in the clear, wherever the
 * `.bind` was written, so the project a line gets written to would be whatever
 * the caller sent. Captured by a `"use server"` closure in a server component
 * instead, it is encrypted, and the project is the one the page was served for.
 *
 * As with the presses, that is not an entitlement check — it says which page
 * made the call, not who was holding it. Phase 8 answers that from the session.
 */
export type AddDeliverableAction = (
  previous: AddDeliverableState,
  formData: FormData,
) => Promise<AddDeliverableState>;

/**
 * A deliverable was written. The fields come back empty rather than echoing
 * what was typed: the line is still on screen, ready for the next one, and
 * leaving the last title in it invites adding it twice.
 */
export function addedDeliverableState(
  added: AddedDeliverable,
): AddDeliverableState {
  return { ...INITIAL_ADD_DELIVERABLE_STATE, added };
}

/** Validation refused the submission. Nothing was written. */
export function rejectedAddState(
  fields: DeliverableFormFields,
  errors: FieldErrors<DeliverableFieldName>,
): AddDeliverableState {
  return { ...rejectedFormState(fields, errors), added: null };
}

/** The submission was good and could not be saved. */
export function failedAddState(
  fields: DeliverableFormFields,
  formError: string,
): AddDeliverableState {
  return { ...failedFormState(fields, formError), added: null };
}

/**
 * What to say after a deliverable is added, or null when there is nothing to
 * say.
 *
 * The form does not navigate, so a successful add changes the page in two
 * places a reader may be looking at neither of: a new line at the end of the
 * list, and three boxes that just emptied. Anyone working from a screen
 * reader gets no notification of either. This is the sentence that goes in a
 * live region, and it names the title — "Added" alone leaves the reader
 * guessing whether it was the line they meant.
 */
export function addedNotice(state: AddDeliverableState): string | null {
  if (state.added === null) return null;
  return `Added “${state.added.title}” to the end of the scope list.`;
}
