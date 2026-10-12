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

/**
 * Two titles the same, as a reader would judge it.
 *
 * Case folded and internal runs of whitespace collapsed, because neither
 * difference is one anybody means: a list where "Build" and "build" appear is
 * a list with the same line twice, and so is one where a pasted title carries
 * a double space the reader cannot see. Judging them identical is what lets
 * the preview mention it.
 *
 * Only ever used to compare. Nothing is stored normalised — the title that
 * gets written is the one that was pasted, because deciding how somebody's
 * scope list should be capitalised is not this feature's business.
 */
function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The remarks a readable line can carry.
 *
 * Both are about a title turning up twice, which is the one mistake a paste
 * makes that no per-line rule can catch: every line is fine on its own, and
 * the list as a whole has a line in it twice. Neither stops the import —
 * a scope list is allowed to hold "Revision round" three times, and often
 * should — so they are worded as what will happen rather than as a refusal,
 * and the reader decides.
 */
export const IMPORT_NOTES = {
  repeated: "Says the same as an earlier line in this paste; both are added.",
  agreed:
    "Already on this project's scope list; this adds a second line saying it.",
} as const;

/**
 * What to say about a line that reads perfectly well and may still be a
 * mistake, or null when there is nothing to say.
 *
 * Both remarks where both apply, joined, in that order: the repeat inside the
 * paste is the one the reader fixes by editing the box in front of them, so it
 * goes first.
 */
export function importNote(
  title: string,
  earlier: ReadonlySet<string>,
  agreed: ReadonlySet<string>,
): string | null {
  const key = titleKey(title);
  const notes = [
    earlier.has(key) ? IMPORT_NOTES.repeated : null,
    agreed.has(key) ? IMPORT_NOTES.agreed : null,
  ].filter((note) => note !== null);

  return notes.length === 0 ? null : notes.join(" ");
}

/** A project's agreed titles as the keys the notes compare against. */
export function titleKeys(titles: readonly string[]): Set<string> {
  return new Set(titles.map(titleKey));
}

/**
 * What stops a paste before any of it is read as deliverables.
 *
 * These are refusals about the text, not about a line, so they are shown
 * against the box rather than in a preview — there is nothing worth previewing
 * in either case. The sentences say what to do about it, because both are
 * things a reader does to the paste rather than to the project.
 */
export const IMPORT_TEXT_PROBLEMS = {
  empty: "Paste a scope list to import — one deliverable per line.",
  tooLong: `That paste is longer than ${MAX_IMPORT_CHARS.toLocaleString("en-GB")} characters, which is a document rather than a scope list. Paste just the deliverables.`,
} as const;

/**
 * Too many lines to check, with the count said out loud.
 *
 * The number is in the sentence because the reader cannot see it: a box
 * holding two hundred lines looks much like one holding ninety, and "too many"
 * without a figure leaves them deleting lines and pressing again to find out.
 */
export function tooManyLinesProblem(count: number): string {
  return `That paste has ${count} lines on it, and ${MAX_IMPORT_LINES} is the most that can be imported at once. Split it and import the first ${MAX_IMPORT_LINES}.`;
}

/**
 * Why the paste cannot be read at all, or null when it can be.
 *
 * In this order, because each question is only sensible once the one before it
 * is answered: an empty box is the ordinary case of a form pressed too early,
 * a wall of text is refused as text before it becomes a hundred line problems,
 * and only then is the line count worth counting.
 */
export function importTextProblem(text: string): string | null {
  if (text.trim() === "") return IMPORT_TEXT_PROBLEMS.empty;
  if (text.length > MAX_IMPORT_CHARS) return IMPORT_TEXT_PROBLEMS.tooLong;

  const lines = importTextLines(text);
  if (lines.length > MAX_IMPORT_LINES) {
    return tooManyLinesProblem(lines.length);
  }
  return null;
}

/**
 * A paste, read, as the preview shows it.
 *
 * Every line is kept, readable or not, because the preview's job is to let the
 * reader check the parse line by line against the box above it — a preview
 * that silently dropped the lines it could not read would be a list of
 * successes with gaps in the numbering.
 *
 * The drafts are the same lines again, in order, reduced to what would be
 * written. Carried rather than derived at the call site so that the rows that
 * get written are the rows that were shown, by construction: one walk of the
 * paste, one answer, and no second filter that could disagree with the table.
 *
 * The two counts are what the summary is said from. Both are derivable from
 * the lines and both are counted here, in the same walk, because a preview
 * that reported four problems and showed three would be read as the bug it is.
 */
export type ImportPreview = {
  readonly lines: readonly ImportLine[];
  /** What would be written, in the order it would be written. */
  readonly drafts: readonly ImportDraft[];
  /** How many lines could not be read at all. */
  readonly problemCount: number;
  /** How many readable lines have something worth mentioning about them. */
  readonly noteCount: number;
};

/**
 * The paste read against what the project already has agreed.
 *
 * The agreed titles come from the caller — they are a database read, and this
 * file does not do those — and they are only ever compared, never written: a
 * line that repeats one already on the list still imports, because a scope
 * list is allowed to say "Revision round" twice and often has to.
 *
 * A line's note is decided before its own title joins the set, so the first of
 * three identical lines is unremarked and the second and third say they repeat
 * it. The alternative marks all three, which reads as though something is
 * wrong with the first one too.
 *
 * Refused lines contribute no title. A line that could not be read is not a
 * deliverable, and letting its text count as one would have the line after it
 * claiming to repeat something that is not being imported.
 */
export function previewImport(
  text: string,
  agreedTitles: readonly string[],
): ImportPreview {
  const agreed = titleKeys(agreedTitles);
  const earlier = new Set<string>();

  const lines: ImportLine[] = [];
  const drafts: ImportDraft[] = [];
  let problemCount = 0;
  let noteCount = 0;

  for (const numbered of importTextLines(text)) {
    const read = parseImportLine(numbered);
    if (!read.ok) {
      problemCount += 1;
      lines.push(read);
      continue;
    }

    const note = importNote(read.draft.title, earlier, agreed);
    if (note !== null) noteCount += 1;
    earlier.add(titleKey(read.draft.title));

    lines.push({ ...read, note });
    drafts.push(read.draft);
  }

  return { lines, drafts, problemCount, noteCount };
}

/**
 * Whether this preview is one that may be committed.
 *
 * All or nothing, deliberately: one line the parser could not read stops the
 * whole paste. The alternative — import the nine good lines and report the
 * tenth — leaves the reader holding a half-imported list and a sentence about
 * a line they can no longer see in context, and the only way back is to work
 * out which nine landed. A paste is a single statement of what was agreed, and
 * it is easier to fix one line in the box than to reconcile a list afterwards.
 *
 * A paste that reads as no deliverables at all cannot be committed either.
 * Pressing Import on it would report success and add nothing.
 */
export function canImport(preview: ImportPreview): boolean {
  return preview.problemCount === 0 && preview.drafts.length > 0;
}
