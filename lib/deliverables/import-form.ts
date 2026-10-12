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
