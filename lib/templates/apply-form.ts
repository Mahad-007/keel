import { readFields } from "@/lib/forms/form-data";
import { requiredChoice } from "@/lib/forms/choice";
import { collect, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";

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
