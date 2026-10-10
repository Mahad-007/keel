import { readFields } from "@/lib/forms/form-data";
import { collect, type ParseResult } from "@/lib/forms/result";
import { initialFormState, type FormState } from "@/lib/forms/state";
import { requiredText } from "@/lib/forms/text";

import { PROJECT_FIELD_LIMITS } from "./form";

/**
 * The form that copies a project, from submitted strings to something the
 * data layer will accept.
 *
 * One field, and it is not any of the ones being copied. What crosses over is
 * decided by `duplicate.ts` and is not up for negotiation at the moment of the
 * press: a form offering checkboxes for the client, the value and the rate
 * would be the new-project form with extra steps, and the whole value of
 * duplication is not having to fill that in again. So the only thing asked for
 * is the one thing a copy cannot inherit — what to call it.
 *
 * Pure, like every other form module here: fields in, result out, no request
 * and no database.
 */

/**
 * The one field, as a list, because the reader, the validator and the focus
 * hook all take the same list — and a second field added later has to appear
 * in the order the form lays them out rather than wherever it was declared.
 */
export const DUPLICATE_FIELD_NAMES = ["name"] as const;

export type DuplicateFieldName = (typeof DUPLICATE_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type DuplicateFormFields = Record<DuplicateFieldName, string>;

/**
 * Which form these fields belong to, for the ids they render under.
 *
 * The overview tab already holds the status form, and both forms sit on one
 * page, so the ids are namespaced for the reason `fieldId` gives: two controls
 * with one id is a label that focuses the wrong box. Nothing clashes today —
 * the other form asks for a reason — and that is exactly the kind of thing
 * that stops being true when a field is added.
 */
export const DUPLICATE_FIELD_SCOPE = "duplicate";

export const EMPTY_DUPLICATE_FIELDS: DuplicateFormFields = { name: "" };

export type DuplicateFormState = FormState<DuplicateFieldName>;

export function readDuplicateFields(formData: FormData): DuplicateFormFields {
  return readFields(formData, DUPLICATE_FIELD_NAMES);
}

/**
 * The word a copy is marked with until somebody names it properly.
 *
 * A suffix rather than a prefix, so the two projects sort together in a list
 * ordered by name and read as the pair they are. Lower case and bracketed
 * because it is a note, not part of the engagement's name — nobody calls a
 * project "Copy of the Harbour rebuild" out loud.
 */
export const DUPLICATE_NAME_SUFFIX = " (copy)";

/**
 * What the name box opens holding: the source project's name, marked as a
 * copy.
 *
 * It has to be filled in with something. Two projects for one client with
 * identical names is the state every list in the app would then have to be
 * read twice, and a blank box in front of somebody who pressed "duplicate" is
 * a question they did not come here to answer. The suffix is the honest
 * default: it says which one is the copy without pretending to know what the
 * new engagement is called.
 *
 * It is a suggestion in the ordinary sense — the box is editable, and a reader
 * who knows the copy is "Phase two" types that instead.
 *
 * Cut to the limit the validator enforces, with the suffix kept and the name
 * shortened to make room for it. A prefilled value its own form would reject
 * is worse than an empty box, and of the two halves the suffix is the one
 * carrying information the reader cannot get from anywhere else.
 */
export function suggestedDuplicateName(projectName: string): string {
  const room = PROJECT_FIELD_LIMITS.name - DUPLICATE_NAME_SUFFIX.length;
  const base = projectName.trim().slice(0, room).trimEnd();
  return `${base}${DUPLICATE_NAME_SUFFIX}`;
}

/**
 * What the form starts from on a given project: the one box, holding the
 * suggested name.
 *
 * A function rather than a constant, because the suggestion depends on the
 * project — and it lives here rather than beside the page for the usual
 * reason: a `"use server"` module may only export async functions.
 */
export function initialDuplicateState(projectName: string): DuplicateFormState {
  return initialFormState({
    ...EMPTY_DUPLICATE_FIELDS,
    name: suggestedDuplicateName(projectName),
  });
}

/** What the form yields once the name is good: the only thing it asks for. */
export type DuplicateFormValue = {
  readonly name: string;
};

/**
 * The submitted form, checked.
 *
 * The name is required even though the box opens prefilled, because a reader
 * who clears it has said something: a copy with no name is not what they were
 * reaching for. Blank is the one answer this form cannot act on — the copy has
 * to be findable in a list afterwards — so it comes back as a message rather
 * than quietly falling back to the suggestion.
 *
 * The same ceiling as the project form's own name field, taken from it rather
 * than restated: this writes to that column, and two numbers for one limit is
 * one of them being wrong.
 */
export function parseDuplicateForm(
  fields: DuplicateFormFields,
): ParseResult<DuplicateFormValue, DuplicateFieldName> {
  const parsed = collect({
    name: requiredText(fields.name, {
      label: "Name",
      max: PROJECT_FIELD_LIMITS.name,
    }),
  });

  if (!parsed.ok) return parsed;
  return { ok: true, value: { name: parsed.value.name } };
}

/**
 * The things that can stop a copy that the form itself cannot see.
 *
 * Every one of them is reachable from a page that was correct when it
 * rendered: the project can be deleted while this form sits open, and a line
 * of its scope can be edited into a state no copy can carry. The sentences say
 * what to do about it rather than only what went wrong, because in each case
 * there is something to do — and none of the three is fixed by pressing the
 * button again, so none of them says to.
 */
export const DUPLICATE_PROBLEMS = {
  missingProject:
    "That project no longer exists, so there is nothing to copy. Nothing was written.",
  negativeEstimate:
    "A deliverable on this project has an estimate below zero, which a copy cannot carry. Nothing was copied — the scope tab names the lines to fix.",
  unusableScope:
    "A deliverable on this project cannot be copied — a line with no title, or an estimate that is not a whole number of minutes. Nothing was copied; the scope tab is where to find it.",
  failed: "Could not copy that project. Nothing was written — try again.",
} as const;

/**
 * What to say when the copy never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was written, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with the copy already made. Nor does it say "try
 * again", which is the instruction that would leave two copies to tell apart —
 * and a duplicated duplicate is a whole project to delete, not a line.
 */
export const DUPLICATE_NO_ANSWER =
  "Could not tell whether the copy was made — the answer never arrived. Check the project list before pressing again.";
