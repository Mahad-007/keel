import { readField, readFields } from "@/lib/forms/form-data";
import { type FormState } from "@/lib/forms/state";

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
