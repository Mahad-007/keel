import { DELIVERABLE_FIELD_LIMITS } from "./form";

/**
 * A scope list arriving as pasted text, one deliverable per line.
 *
 * Scope is almost never typed first into this app. It was agreed in an email,
 * a proposal, or a spreadsheet, and the fastest honest way to get it onto a
 * project is to paste the list somebody already wrote. The add line is for the
 * deliverable that was forgotten; this is for the twelve that were not.
 *
 * Everything here is a pure function over a string. Parsing is the whole risk
 * of the feature — a paste misread by one line writes eleven deliverables and
 * a twelfth that is half of two of them — so it happens here, where every rule
 * is testable without a database, and the result is shown to the reader before
 * anything is written.
 *
 * Nothing in this file writes, counts rows, or knows what a page looks like.
 */

/**
 * The most lines one paste may carry.
 *
 * A scope list is a thing two people read down together, and a hundred lines
 * is already past the point where anybody does. Past that the likeliest
 * reading is that somebody pasted the wrong half of a document — a mail
 * thread, a CSV of time entries — and the preview for it would be a hundred
 * rows nobody checks, which defeats the point of previewing at all.
 *
 * It also bounds the write: every line is a row, written one at a time
 * through the one door new scope comes through.
 */
export const MAX_IMPORT_LINES = 100;

/**
 * The most text one paste may carry, which is the cap the box itself carries
 * as `maxLength`.
 *
 * Generous against the line limit — a hundred lines at the title limit plus an
 * estimate apiece is comfortably under this — because the two caps answer
 * different questions. The line count is about what a reader can check; this
 * is about what arrives at all, so that a pasted document is refused as text
 * rather than parsed into a hundred problems first.
 */
export const MAX_IMPORT_CHARS = 20_000;

/**
 * One line of the paste, with the place it came from.
 *
 * The number is the line's position in the text as pasted, counting from one,
 * and it survives every later step: a problem reported against line 7 has to
 * point at the seventh line of the box the reader is looking at, not at the
 * seventh line that happened to have something on it.
 */
export type NumberedLine = {
  readonly number: number;
  /** The line as pasted, trimmed of surrounding whitespace. */
  readonly text: string;
};

/**
 * What one readable line amounts to: exactly the two columns a pasted list can
 * carry.
 *
 * No description, which is deliberate. A paste is one line per deliverable, so
 * there is nowhere for a paragraph to go, and inventing a second separator for
 * one would make every line ambiguous to serve a field nobody pastes. The
 * detail behind a title is added afterwards by editing the line.
 */
export type ImportDraft = {
  readonly title: string;
  /** Whole minutes. Zero where the line carried no estimate. */
  readonly estimatedMinutes: number;
};

/**
 * One line of the paste, read.
 *
 * A line either yields a draft or a sentence saying why it does not, and both
 * carry the original text and number so the preview can show the line beside
 * what it was understood as. That is the whole job of the preview: the reader
 * checks the parse, not the paste.
 *
 * The note on a readable line is a remark rather than a refusal — a title that
 * repeats one above it, or one already on the project's list. Both import
 * perfectly well and both are usually a mistake, which is exactly the kind of
 * thing a preview exists to catch.
 */
export type ImportLine = NumberedLine &
  (
    | {
        readonly ok: true;
        readonly draft: ImportDraft;
        readonly note: string | null;
      }
    | { readonly ok: false; readonly problem: string }
  );

/** How long a pasted title may be: the column's limit, not a second one. */
export const MAX_IMPORT_TITLE = DELIVERABLE_FIELD_LIMITS.title;
