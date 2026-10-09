import { readFields } from "@/lib/forms/form-data";
import { collect, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";
import { optionalText, requiredText } from "@/lib/forms/text";

/**
 * The form that saves a project's scope list as a template, from submitted
 * strings to something the data layer will accept.
 *
 * Two fields, and neither of them is a deliverable. What gets saved is whatever
 * the project's scope list holds at the moment of the press — the form is not
 * where lines are chosen, because a form that asked you to tick eight
 * checkboxes would be a form you edit the project through instead. So the only
 * things asked for are the two that make a template findable later.
 *
 * Pure, like every other form module here: fields in, result out, no request
 * and no database.
 */

/**
 * In the order the form lays them out, which is the order errors are walked
 * in — the cursor after a rejected submission has to land on the first problem
 * the reader would reach on screen.
 */
export const TEMPLATE_FIELD_NAMES = ["name", "description"] as const;

export type TemplateFieldName = (typeof TEMPLATE_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type TemplateFormFields = Record<TemplateFieldName, string>;

/**
 * How long each field may be. Exported because the inputs carry the same
 * numbers as `maxLength`: two copies of a limit drift, and the day they do the
 * browser stops someone at a length the validator would have accepted.
 *
 * The name matches a deliverable's title rather than a project's name, because
 * that is what it is competing with for space — a template name is read in a
 * picker, one line at a time, beside a count and an estimate.
 */
export const TEMPLATE_FIELD_LIMITS = {
  name: 120,
  description: 2000,
} as const;

export const EMPTY_TEMPLATE_FIELDS: TemplateFormFields = {
  name: "",
  description: "",
};

export type TemplateFormState = FormState<TemplateFieldName>;

/**
 * What the form starts from. Defined here rather than beside the action,
 * because a `"use server"` module may only export async functions.
 */
export const INITIAL_TEMPLATE_FORM_STATE: TemplateFormState =
  initialFormState(EMPTY_TEMPLATE_FIELDS);

export function readTemplateFields(formData: FormData): TemplateFormFields {
  return readFields(formData, TEMPLATE_FIELD_NAMES);
}

/**
 * What the form yields once both fields are good: exactly the two columns of
 * a template row that a person decides.
 */
export type TemplateFormValue = {
  readonly name: string;
  readonly description: string | null;
};

/**
 * The submitted form, checked.
 *
 * The name is required and the description is not, which is the opposite way
 * round from how a template is usually described to somebody — "it's the one
 * we use for retainers" is a description, not a name. It is required anyway,
 * because the name is what the picker shows: a nameless template is an option
 * nobody can pick deliberately.
 */
export function parseTemplateForm(
  fields: TemplateFormFields,
): ParseResult<TemplateFormValue, TemplateFieldName> {
  const parsed = collect({
    name: requiredText(fields.name, {
      label: "Template name",
      max: TEMPLATE_FIELD_LIMITS.name,
    }),
    description: optionalText(fields.description, {
      label: "Description",
      max: TEMPLATE_FIELD_LIMITS.description,
    }),
  });

  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value };
}
