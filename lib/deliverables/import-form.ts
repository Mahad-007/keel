import { textFingerprint } from "@/lib/forms/fingerprint";
import { readField, readFields } from "@/lib/forms/form-data";
import type { FieldErrors } from "@/lib/forms/result";
import { formatMinutes } from "@/lib/minutes";
import { deliverablesPhrase } from "@/lib/projects/scope-summary";
import {
  initialFormState,
  rejectedFormState,
  type FormState,
} from "@/lib/forms/state";

import type { ImportPreview } from "./import";

/**
 * The form that imports a pasted scope list, as the two presses it takes.
 *
 * One textarea and two buttons. The first press reads the paste and answers
 * with a preview; the second commits exactly what the preview showed. Both go
 * to the same action, because they are two steps of one submission rather than
 * two forms — the text has to survive the round trip either way, and a second
 * form would need somewhere to keep it.
 *
 * Pure, like every other form module here: it takes the submitted fields and
 * nothing else, so every branch can be tested without a request or a database.
 */

/**
 * The field errors can be shown against. One, because there is one thing a
 * reader typed — the per-line problems live in the preview beside the line
 * they belong to, which is the only place they can point at anything.
 */
export const IMPORT_FIELD_NAMES = ["lines"] as const;

export type ImportFieldName = (typeof IMPORT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back. */
export type ImportFormFields = Record<ImportFieldName, string>;

export const EMPTY_IMPORT_FIELDS: ImportFormFields = { lines: "" };

/**
 * What the second press carries so the server can tell whether the box has
 * moved since the preview: a hidden input holding the stamp the preview came
 * back with.
 *
 * Not one of the field names above. Nothing a reader typed is in it, so an
 * error on it is not an error on a field — a stale stamp is reported as a
 * fresh preview and a sentence about the whole form.
 */
export const STAMP_FIELD_NAME = "stamp";

/** The preview a submission produced, and the text it was made from. */
export type PreviewedPaste = {
  readonly preview: ImportPreview;
  /** The stamp of the pasted text, for the next press to be checked against. */
  readonly stamp: string;
};

/**
 * What the import form hands back.
 *
 * Three parts beyond the usual form state, and the shape is the flow: nothing
 * previewed and nothing imported is a fresh form, a preview with no import is
 * the middle step, and an import is the end of it. A state can hold a preview
 * *and* a sentence saying nothing was written — that is what a commit press on
 * an edited box comes back as, and it is why the preview is not simply dropped
 * when something goes wrong.
 */
export type ImportScopeState = FormState<ImportFieldName> & {
  readonly previewed: PreviewedPaste | null;
  readonly imported: ImportedScope | null;
};

/**
 * What a committed import wrote.
 *
 * The ids rather than a count, for the reason the apply control carries them:
 * the count is `length`, so there is no second number to disagree with it, and
 * the ids tell two imports of the same list apart — which the live region
 * needs, since identical text under an identical key is no change to the DOM
 * and the second import would be announced to nobody.
 *
 * The total comes along because the sentence afterwards says it. Six
 * deliverables and eighteen hours is a different thing to have just agreed to
 * than six deliverables and two, and the reader has one chance to notice.
 */
export type ImportedScope = {
  readonly deliverableIds: readonly string[];
  readonly estimatedMinutes: number;
};

/**
 * Which press this is, which the browser reports by sending the name and
 * value of the button that was used and nobody else's.
 *
 * A submission that names no intent is a preview. That is the safe default in
 * the only sense that matters: previewing writes nothing, so a submission the
 * form did not produce — a stale page, something posting by hand — gets a
 * table back rather than fourteen rows in somebody's scope list.
 */
export const INTENT_FIELD_NAME = "intent";

export type ImportIntent = "preview" | "import";

export const IMPORT_INTENT: ImportIntent = "import";

export function readImportIntent(formData: FormData): ImportIntent {
  return readField(formData, INTENT_FIELD_NAME).trim() === IMPORT_INTENT
    ? "import"
    : "preview";
}

export function readImportFields(formData: FormData): ImportFormFields {
  return readFields(formData, IMPORT_FIELD_NAMES);
}

/**
 * The stamp the form posted back, or `""` when it posted none.
 *
 * Read rather than validated, because there is nothing to validate: a stamp
 * that is not the one this text would produce is a stamp that does not match,
 * whether it is stale, blank or invented. `matchesFingerprint` is the one place
 * that judgement is made.
 */
export function readPreviewStamp(formData: FormData): string {
  return readField(formData, STAMP_FIELD_NAME);
}

/**
 * What the form starts from. Defined here rather than beside the page because
 * a `"use server"` module may only export async functions.
 */
export const INITIAL_IMPORT_STATE: ImportScopeState = {
  ...initialFormState(EMPTY_IMPORT_FIELDS),
  previewed: null,
  imported: null,
};

/**
 * A preview together with the stamp of the text it was made from.
 *
 * The stamp is taken here rather than by the caller so that it cannot be taken
 * from anything but the text that was actually read. A stamp computed from the
 * previous state, or from the text before trimming, would be a stamp the next
 * press could never match — and the reader would be told to preview again,
 * forever.
 */
export function previewedPaste(
  lines: string,
  preview: ImportPreview,
): PreviewedPaste {
  return { preview, stamp: textFingerprint(lines) };
}

/**
 * The paste was read and nothing was written. The middle step.
 *
 * The fields come back exactly as submitted, because the box above the preview
 * is the thing the reader edits next: a table pointing at line 7 is no use
 * beside a box that has been emptied.
 */
export function previewedImportState(
  fields: ImportFormFields,
  preview: ImportPreview,
): ImportScopeState {
  return {
    fields,
    errors: {},
    formError: null,
    previewed: previewedPaste(fields.lines, preview),
    imported: null,
  };
}

/**
 * The paste landed. The box comes back empty and the preview with it.
 *
 * Emptied rather than echoed, which is the opposite of what a rejection does
 * and for the same reason: the lines are now on the list above, and a box
 * still holding them is one press away from a second copy of the whole scope
 * list. The preview goes too — a table describing rows that now exist as real
 * deliverables, two feet below the real ones, would be read as a second list.
 */
export function importedScopeState(imported: ImportedScope): ImportScopeState {
  return { ...INITIAL_IMPORT_STATE, imported };
}

/**
 * The paste itself was refused — empty, too long, too many lines. Nothing was
 * read and nothing was written.
 *
 * No preview comes back, because there is nothing to preview: every one of
 * these is a refusal about the text as a whole, and the message sits under the
 * box where the text is.
 */
export function rejectedImportState(
  fields: ImportFormFields,
  errors: FieldErrors<ImportFieldName>,
): ImportScopeState {
  return { ...rejectedFormState(fields, errors), previewed: null, imported: null };
}

/**
 * A press that wrote nothing and has a preview to show for it: the commit
 * press on an edited box, on a paste with an unreadable line in it, or one the
 * database refused.
 *
 * The preview is kept deliberately. Every one of these cases ends with the
 * reader pressing Import again, and dropping the table would make them press
 * Preview first — twice the work for a message that already says what to do.
 * It is the freshly read preview rather than the one from last time, so the
 * table and the box always describe the same text.
 */
export function refusedImportState(
  fields: ImportFormFields,
  previewed: PreviewedPaste | null,
  formError: string,
): ImportScopeState {
  return { fields, errors: {}, formError, previewed, imported: null };
}

/**
 * The things that can stop an import, as sentences for the person who pressed.
 *
 * Each one says that nothing was written, because every one of them follows a
 * press of a button labelled Import and the scope list above is unchanged — a
 * reader who is not told will go looking for the lines. And each says what to
 * do next, which is different in every case: press again, preview again, fix a
 * line, reload.
 */
export const IMPORT_PROBLEMS = {
  /**
   * The commit press arrived with no stamp on it.
   *
   * Not reachable from the form as rendered — the Import button only exists
   * once there is a preview on screen — so this is a page left open across a
   * deploy, or a POST somebody built. It is answered with the preview the
   * press should have had, rather than with a refusal to engage.
   */
  notPreviewed:
    "Nothing was imported: a paste is previewed before it is committed. Check the lines below and press Import to add them.",
  /**
   * The box was edited after the preview. The commonest of these by far — a
   * reader reads the table, spots a line, fixes it, and presses Import out of
   * habit rather than Preview.
   */
  changed:
    "The paste changed after it was previewed, so nothing was imported. The preview below has been read again from what is in the box now — press Import to add that.",
  unreadableLines:
    "Nothing was imported: a line below cannot be read as a deliverable, and a paste is imported whole or not at all. Fix or delete it, then press Preview again.",
  /** A paste that reads as no deliverables at all. An import of nothing would report success and change nothing. */
  nothingReadable:
    "Nothing in that paste reads as a deliverable, so nothing was imported.",
  missingProject:
    "That project no longer exists, so there is nothing to import into.",
  /**
   * The paste could not be previewed because this project's own scope list
   * could not be read — and it has to be read, because a preview says which
   * pasted lines repeat something already agreed.
   */
  previewFailed:
    "Could not read this project's scope list, so that paste could not be previewed. Nothing was imported — try again.",
  failed:
    "Could not import that paste. Nothing was added to the scope list — try again.",
} as const;

/**
 * What to say when the import never got an answer — the connection dropped,
 * the tab was suspended mid-request, the request was aborted.
 *
 * It does not say nothing was written, because from the client there is no way
 * to know: the request may have been lost on the way out, or the answer lost
 * on the way back with twelve rows already created. Nor does it say "try
 * again", which is the instruction that would import the whole list twice.
 * Reloading is the only honest one — the scope list above is what the server
 * says, so reading it answers the question.
 */
export const IMPORT_NO_ANSWER =
  "Could not tell whether that paste was imported — the answer never arrived. Reload to see what the scope list says now.";

/**
 * What to say after a paste is imported, or null when there is nothing to say.
 *
 * The form does not navigate, so a successful import changes the page in two
 * places a reader may be looking at neither of: a dozen new lines at the end
 * of a list that was already long, and a box that just emptied. Anyone working
 * from a screen reader gets no notification of either.
 *
 * It says the count and the total, which are the two things that cannot be
 * checked at a glance — twelve new rows at the end of a list of nine look much
 * like the nine — and "the end", which is the word that says what was *not*
 * touched. A list with no estimates on it says so rather than claiming a total
 * of nothing: every estimate is at or above zero by the time it is written, so
 * a total of zero means every line of the paste was unsized.
 */
export function importedNotice(state: ImportScopeState): string | null {
  if (state.imported === null) return null;

  const { deliverableIds, estimatedMinutes } = state.imported;
  const count = deliverablesPhrase(deliverableIds.length);
  if (estimatedMinutes === 0) {
    return `Added ${count} to the end of the scope list, none of them estimated.`;
  }
  return `Added ${count} and ${formatMinutes(estimatedMinutes)} to the end of the scope list.`;
}
