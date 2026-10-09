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

/**
 * Which form these fields belong to, for the ids they render under.
 *
 * The scope tab holds three forms at once and two of them ask for a
 * "description", so the ids have to be namespaced or a label focuses the wrong
 * box. It is a constant rather than a string typed into each component because
 * the fields and the focus hook have to agree on it exactly: a form whose
 * controls are scoped and whose hook is not puts the cursor in somebody else's
 * textarea, which is worse than not moving it at all.
 */
export const TEMPLATE_FIELD_SCOPE = "template";

export const EMPTY_TEMPLATE_FIELDS: TemplateFormFields = {
  name: "",
  description: "",
};

export type TemplateFormState = FormState<TemplateFieldName>;

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

/**
 * What the name box starts with: the project's own name.
 *
 * A template saved off "Harbour Co — site rebuild" is almost always going to
 * be called that, or that with a word changed, and a prefilled box is the
 * difference between a press and a sentence to compose. It is a suggestion in
 * the ordinary sense — the field is editable and nothing defaults to it if the
 * reader clears it, because a template nobody named is one nobody will
 * recognise in a picker a month from now.
 *
 * Trimmed and cut to the limit, so the box never opens holding a value its own
 * validator would refuse. A project name is allowed to be longer than a
 * template name, and a prefill that is instantly an error is worse than an
 * empty box.
 */
export function suggestedTemplateName(projectName: string): string {
  return projectName.trim().slice(0, TEMPLATE_FIELD_LIMITS.name);
}

/**
 * What the form starts from on a given project: the two boxes, with the name
 * suggested from the project the scope list belongs to.
 *
 * A function rather than a constant, because the suggestion depends on the
 * project — and it lives here rather than beside the page for the usual
 * reason: a `"use server"` module may only export async functions.
 */
export function initialSaveTemplateState(
  projectName: string,
): SaveTemplateState {
  return {
    ...initialFormState({
      ...EMPTY_TEMPLATE_FIELDS,
      name: suggestedTemplateName(projectName),
    }),
    saved: null,
  };
}

/**
 * What the save hands back, which is a form state plus the one thing a
 * redirecting form never needs: what was just saved.
 *
 * Saving a template does not navigate. The reader is looking at the scope list
 * they just saved, and taking them to a template page would be taking them
 * away from the project they were working on to look at a copy of it. So the
 * form stays where it is, and this is how it knows the press landed.
 *
 * The row rather than a boolean, because the sentence worth saying afterwards
 * names what was saved and how many lines went into it — and the id tells two
 * saves apart that chose the same name, which the table allows and a live
 * region needs: its content has to change for a screen reader to notice it.
 */
export type SavedTemplate = {
  readonly id: string;
  readonly name: string;
  /** How many lines were captured, which is the fact nobody can see. */
  readonly lineCount: number;
};

export type SaveTemplateState = TemplateFormState & {
  readonly saved: SavedTemplate | null;
};

/**
 * A template was written. The fields come back as submitted rather than
 * cleared: the form is still on screen under a sentence naming what was saved,
 * and a box that emptied itself would leave the reader unsure which of the two
 * things happened.
 */
export function savedTemplateState(
  fields: TemplateFormFields,
  saved: SavedTemplate,
): SaveTemplateState {
  return { ...initialFormState(fields), saved };
}

/** Validation refused the submission. Nothing was written. */
export function rejectedSaveState(
  fields: TemplateFormFields,
  errors: FieldErrors<TemplateFieldName>,
): SaveTemplateState {
  return { ...rejectedFormState(fields, errors), saved: null };
}

/** The submission was good and could not be saved. */
export function failedSaveState(
  fields: TemplateFormFields,
  formError: string,
): SaveTemplateState {
  return { ...failedFormState(fields, formError), saved: null };
}

/**
 * The things that can stop a save that the form itself cannot see.
 *
 * `emptyScope` is the one worth having: a template of no lines is not a
 * template, and the reader pressing the button is looking at the scope list it
 * would have been made from, so the sentence says what to do about it rather
 * than only what went wrong.
 */
export const SAVE_PROBLEMS = {
  emptyScope:
    "There is nothing to save as a template yet — add a deliverable to this project first.",
  missingProject:
    "That project no longer exists, so there is no scope list to save.",
  negativeEstimate:
    "A deliverable on this project has an estimate below zero, which a template cannot carry. The scope summary above names how many — fix those lines and save again.",
  failed: "Could not save that template. Nothing was written — try again.",
} as const;

/**
 * What to say when the save never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was written, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with the template already saved. Nor does it say "try
 * again", which is the instruction that would save the same template twice.
 */
export const SAVE_NO_ANSWER =
  "Could not tell whether that template was saved — the answer never arrived. Reload and check the template list before saving again.";

/**
 * What to say after a template is saved, or null when there is nothing to say.
 *
 * The press changes nothing a reader can see: the scope list above is
 * untouched, and the template it went into is somewhere else entirely. So the
 * sentence has to carry the whole result — the name it was filed under, and
 * how many lines went with it, which is the number that would otherwise only
 * be discovered on the project it is applied to.
 */
export function savedTemplateNotice(state: SaveTemplateState): string | null {
  if (state.saved === null) return null;
  const { name, lineCount } = state.saved;
  const lines =
    lineCount === 1 ? "one deliverable" : `${lineCount} deliverables`;
  return `Saved “${name}” as a template, with ${lines} on it.`;
}
