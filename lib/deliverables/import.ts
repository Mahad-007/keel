import { optionalEstimateMinutes } from "@/lib/forms/estimate";
import { collect, type FieldErrors } from "@/lib/forms/result";
import { requiredText } from "@/lib/forms/text";

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

/**
 * The pasted text as the lines that have something on them, each remembering
 * where it was.
 *
 * Blank lines are dropped rather than refused. A pasted list routinely has one
 * at the end, and a double space between two groups of deliverables is how
 * people write lists — reading either as an empty deliverable would turn the
 * most ordinary paste in the world into an error. What survives is the
 * numbering: the lines keep the positions they had in the box, so a problem on
 * line 9 is reported against the ninth line the reader can count to and not
 * against the seventh one that happened to have text on it.
 *
 * Split on every line ending rather than on `\n` alone. The form layer already
 * normalises what a textarea submits, and this does not depend on that having
 * happened — a caller handing it text straight off a clipboard gets the same
 * answer.
 */
export function importTextLines(text: string): NumberedLine[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line, index) => ({ number: index + 1, text: line.trim() }))
    .filter((line) => line.text !== "");
}

/**
 * Where a line's title stops and its estimate starts.
 *
 * A tab or a vertical bar, whichever comes first, because the two cover the
 * two ways a scope list actually arrives. A list copied out of a spreadsheet
 * or a table is tab-separated and nobody chose that; a list typed into the box
 * needs a mark that can be typed, and a bar is the one character that does not
 * otherwise turn up in the middle of a deliverable's name. A dash would: "Logo
 * — three variants" is a title, not a title and an estimate.
 *
 * One rule rather than two, so there is nothing to get in the wrong order.
 */
const IMPORT_SEPARATOR = /[\t|]/;

/** A line's two halves, before either is checked. */
export type SplitLine = {
  readonly title: string;
  /** What followed the separator, or `""` on a line that had none. */
  readonly estimate: string;
};

/**
 * One line split into what it calls the work and how long it was sized at.
 *
 * Split at the *first* separator only, so everything after it is the estimate
 * — including a second separator. A line with two bars in it is a line nobody
 * meant to write, and `1.5 | ask Dana` reaching the estimate rules as a whole
 * is what gets it refused with a sentence. Taking the middle column and
 * dropping the rest would import that line, silently, missing the half
 * somebody cared enough to type.
 *
 * A line with no separator is all title and no estimate, which is the common
 * case: most pasted lists are a column of names.
 */
export function splitImportLine(text: string): SplitLine {
  const at = text.search(IMPORT_SEPARATOR);
  if (at === -1) return { title: text.trim(), estimate: "" };
  return {
    title: text.slice(0, at).trim(),
    estimate: text.slice(at + 1).trim(),
  };
}

/**
 * The two things a pasted line is checked for, in the order the line reads.
 *
 * Both are reported, joined, rather than the first one found. A line is one
 * row of the preview with one sentence beside it, and a reader who fixes the
 * title only to have the estimate complain on the next press is being made to
 * preview twice for one bad line.
 */
const LINE_FIELDS = ["title", "estimate"] as const;

function lineProblem(errors: FieldErrors<(typeof LINE_FIELDS)[number]>): string {
  return LINE_FIELDS.map((field) => errors[field])
    .filter((message) => message !== undefined)
    .join(" ");
}

/**
 * One line of the paste, read as a deliverable or refused with a sentence.
 *
 * The rules are the add line's rules, called rather than restated: the same
 * title limit, and the same estimate parser that turns `1.5` into ninety
 * minutes and refuses `1,5`. A paste that accepted what the form rejects would
 * be a second way into the same table with a second set of limits, and the
 * difference would only show up as a row the edit form then refuses to save.
 *
 * A line with no estimate is a deliverable with no estimate, which is a zero —
 * the same reading the blank field gives, and the one the scope summary already
 * flags as unsized. Refusing an unestimated line would make the common paste,
 * a plain column of names, impossible to import.
 */
export function parseImportLine(line: NumberedLine): ImportLine {
  const { title, estimate } = splitImportLine(line.text);

  const parsed = collect({
    title: requiredText(title, { label: "Title", max: MAX_IMPORT_TITLE }),
    estimate: optionalEstimateMinutes(estimate),
  });

  if (!parsed.ok) {
    return { ...line, ok: false, problem: lineProblem(parsed.errors) };
  }

  return {
    ...line,
    ok: true,
    draft: {
      title: parsed.value.title,
      estimatedMinutes: parsed.value.estimate,
    },
    note: null,
  };
}
