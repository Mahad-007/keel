import { readFields } from "@/lib/forms/form-data";
import { requiredChoice } from "@/lib/forms/choice";
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

/**
 * The form that applies a saved template to a project: one picker, and the
 * check that what came back out of it is a template that still exists.
 *
 * One field, which is the whole design. Applying a template is not an
 * opportunity to edit it — the lines land as deliverables and every one of
 * them is then editable in place, on the list the reader is already looking
 * at. A form offering to tick which lines to take would be a second, worse
 * scope editor, and the thing it edited would not be saved anywhere.
 */

export const APPLY_FIELD_NAMES = ["template"] as const;

export type ApplyFieldName = (typeof APPLY_FIELD_NAMES)[number];

export type ApplyFormFields = Record<ApplyFieldName, string>;

export const EMPTY_APPLY_FIELDS: ApplyFormFields = { template: "" };

export type ApplyTemplateFormState = FormState<ApplyFieldName>;

export function readApplyFields(formData: FormData): ApplyFormFields {
  return readFields(formData, APPLY_FIELD_NAMES);
}

/**
 * What the picker submitted, checked against the templates that were on offer.
 *
 * The id is checked against the list rather than trusted, because a form is a
 * POST endpoint: the submitted value can name a template somebody deleted
 * while this page sat open, or one that was never offered. The message says
 * which of those it probably was, because the reader's page is simply old and
 * reloading fixes it — "not one of the options offered", the default, reads
 * like an accusation at somebody who only used the dropdown.
 *
 * Checking it here does not save the data layer from checking too: the template
 * can go between this call and the transaction. What it buys is a sentence
 * beside the field instead of a failed write.
 */
export function parseApplyTemplateForm(
  fields: ApplyFormFields,
  offered: readonly string[],
): ParseResult<{ readonly templateId: string }, ApplyFieldName> {
  const parsed = collect({
    template: requiredChoice(fields.template, offered, {
      label: "Template",
      unknown:
        "That template is no longer on the list — reload the page and pick again.",
    }),
  });

  if (!parsed.ok) return parsed;
  return { ok: true, value: { templateId: parsed.value.template } };
}

export const INITIAL_APPLY_TEMPLATE_STATE: ApplyTemplateState =
  { ...initialFormState(EMPTY_APPLY_FIELDS), applied: null };

/**
 * What applying hands back: a form state plus what landed on the project.
 *
 * Applying does not navigate either — the scope list the lines were added to
 * is the thing the reader is looking at, and it is revalidated under them. The
 * name and the count are what the sentence afterwards needs: a template of
 * five lines appended to a list of three changes the list by more than a
 * reader's eye will take in at a glance.
 */
export type AppliedTemplate = {
  readonly id: string;
  readonly name: string;
  /** How many deliverables were written. */
  readonly lineCount: number;
};

export type ApplyTemplateState = ApplyTemplateFormState & {
  readonly applied: AppliedTemplate | null;
};

/**
 * A template was applied. The picker comes back on its placeholder rather
 * than holding what was just applied: the lines are now on the list above, and
 * leaving the template selected invites a second press that would append the
 * same five deliverables again.
 */
export function appliedTemplateState(
  applied: AppliedTemplate,
): ApplyTemplateState {
  return { ...INITIAL_APPLY_TEMPLATE_STATE, applied };
}

/** Validation refused the submission. Nothing was written. */
export function rejectedApplyState(
  fields: ApplyFormFields,
  errors: FieldErrors<ApplyFieldName>,
): ApplyTemplateState {
  return { ...rejectedFormState(fields, errors), applied: null };
}

/** The submission was good and nothing could be written. */
export function failedApplyState(
  fields: ApplyFormFields,
  formError: string,
): ApplyTemplateState {
  return { ...failedFormState(fields, formError), applied: null };
}

/**
 * The things that can stop an apply that the picker itself cannot see.
 *
 * `emptyTemplate` should be unreachable — nothing saves a template with no
 * lines — but the table allows one and a template's lines can be deleted
 * independently of it, so the alternative is a press that reports success and
 * changes nothing. Saying so is cheap; a silent no-op is a bug report.
 */
export const APPLY_PROBLEMS = {
  missingProject:
    "That project no longer exists, so there is nothing to apply a template to.",
  missingTemplate:
    "That template has been deleted. Nothing was added — reload to see what is on offer now.",
  emptyTemplate:
    "That template has no deliverables on it, so there was nothing to add.",
  failed:
    "Could not apply that template. Nothing was added to the scope list — try again.",
} as const;

/**
 * What to say when the apply never got an answer.
 *
 * It does not say "try again", which is the instruction that would append the
 * same five deliverables twice. The scope list above the form is what the
 * server says, so reading it answers the question — the same reasoning as the
 * add line, and a sharper version of it: a duplicated add is one line to
 * delete, and a duplicated apply is five.
 */
export const APPLY_NO_ANSWER =
  "Could not tell whether that template was applied — the answer never arrived. Reload to see what the scope list says now.";

/**
 * What to say after a template is applied, or null when there is nothing to
 * say.
 *
 * It names the template and says where the lines went, because that is the
 * part a reader cannot verify at a glance: five new rows at the end of a list
 * of eight look much like the eight that were already there. "the end" is the
 * load-bearing word — applying a template does not touch what was already
 * agreed, and a reader who thinks it might have is about to check all
 * thirteen.
 */
export function appliedTemplateNotice(
  state: ApplyTemplateState,
): string | null {
  if (state.applied === null) return null;
  const { name, lineCount } = state.applied;
  const lines =
    lineCount === 1 ? "one deliverable" : `${lineCount} deliverables`;
  return `Added ${lines} from “${name}” to the end of the scope list.`;
}
