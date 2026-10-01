import { requiredChoice } from "@/lib/forms/choice";
import { readFields } from "@/lib/forms/form-data";
import { collect, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";
import { optionalText } from "@/lib/forms/text";

import type { ProjectStatus } from "./status";
import {
  allowedTransitions,
  checkTransition,
  TRANSITION_REASON_LIMIT,
  transitionRequiresReason,
  type TransitionProblemCode,
} from "./transitions";

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

/**
 * What the form yields once the move is good: the status to go to, and the
 * reason to file with it — null rather than `""`, because the trail stores
 * absence as NULL and an empty string would read as a reason nobody can see.
 */
export type TransitionFormValue = {
  status: ProjectStatus;
  reason: string | null;
};

/**
 * Which field a refused transition is blamed on.
 *
 * The status, when the move itself is impossible: the page offered it, so the
 * project has moved underneath the reader and the buttons are the stale part.
 * The reason, when the move is fine and what was typed is not — that is the
 * box they can do something about, and marking the buttons instead would send
 * them looking for a problem that is not there.
 */
const PROBLEM_FIELDS: Record<TransitionProblemCode, TransitionFieldName> = {
  illegal: "status",
  "reason-required": "reason",
  "reason-too-long": "reason",
};

/**
 * A submitted status change, checked against the project it is being made to.
 *
 * `from` is the status as last read from the database, so the moves on offer
 * are the ones that project can actually make. That check is repeated inside
 * `transitionProject` against the row in its own transaction — this one is
 * here to produce a message beside the right field, not to be trusted as the
 * last word.
 */
export function parseTransitionForm(
  fields: TransitionFormFields,
  from: ProjectStatus,
): ParseResult<TransitionFormValue, TransitionFieldName> {
  const parsed = collect({
    status: requiredChoice(fields.status, allowedTransitions(from), {
      label: "Status",
      // Nobody types this field, so an unknown value is a page that was
      // rendered before somebody else moved the project.
      unknown:
        "That is not a move this project can make any more. Reload to see where it stands.",
    }),
    reason: optionalText(fields.reason, {
      label: "Reason",
      max: TRANSITION_REASON_LIMIT,
    }),
  });

  if (!parsed.ok) return parsed;

  const { status, reason } = parsed.value;
  const problem = checkTransition(from, status, reason);
  if (problem !== null) {
    return {
      ok: false,
      errors: { [PROBLEM_FIELDS[problem.code]]: problem.message },
    };
  }

  return { ok: true, value: { status, reason } };
}

/** How the reason box is labelled and whether it has to be filled in. */
export type TransitionNotePrompt = {
  readonly label: string;
  readonly hint: string;
  readonly required: boolean;
};

/**
 * What to ask for in the reason box, given where the project stands.
 *
 * The requirement is derived rather than written down twice: a box is required
 * when every move the project can make requires one, which today means a
 * closed project, whose only move is reopening. Asking the transition rules
 * rather than testing for `closed` means a later status with the same property
 * gets the right box without anyone remembering this file.
 *
 * The wording follows from that. A required box asks a question, because the
 * reader has to answer it; an optional one offers somewhere to put a sentence,
 * and says what the sentence is for.
 */
export function transitionNotePrompt(
  from: ProjectStatus,
): TransitionNotePrompt {
  const moves = allowedTransitions(from);
  const required =
    moves.length > 0 && moves.every((to) => transitionRequiresReason(from, to));

  if (required) {
    return {
      label: "Why is this reopening?",
      hint: "Required. A closed project reopens on the record, so say what changed for whoever reads this later.",
      required: true,
    };
  }
  return {
    label: "Note",
    hint: "Optional, and kept with the change — the difference between a project that was paused and one you can remember the reason for.",
    required: false,
  };
}
