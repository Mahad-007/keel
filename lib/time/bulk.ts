/**
 * Filling in a week of the timesheet in one press: many cells typed, many
 * entries written, one transaction.
 *
 * The log-time form on a project page is for one stretch of work at a time,
 * and that is the right shape for the entry made the moment the work stops.
 * It is the wrong shape for the other thing people actually do, which is write
 * up a week on Friday afternoon: three projects across five days is fifteen
 * trips through a form that reloads a page it is not on.
 *
 * The grid is already the shape of that question — a row per project, a column
 * per day — so this turns its cells into boxes. A reader types durations where
 * the work went and presses once.
 *
 * Everything here is a pure function over submitted strings. The risk of a
 * bulk write is entirely in the reading: a grid misread by one column logs
 * Tuesday's work on Monday across every project at once, and there is no
 * single entry to open and correct. So the rules live here, where each is
 * testable without a database, and nothing in this file writes, queries, or
 * knows what a cell looks like.
 *
 * What a typed cell means is **time to add**, not time to replace. A cell is a
 * figure standing for however many entries fell in it, so a typed duration
 * could only "set" it by deciding which of those entries to overwrite — and
 * there is no honest answer to that from a box with one number in it. Adding
 * is the one reading that is never ambiguous and never destroys anything
 * already logged. Corrections stay where they already are: the project's own
 * time list, which shows the entries one at a time.
 */

import type { ParseResult } from "@/lib/forms/result";

/*
  The duration rules come from the log-time form rather than being written
  again here, and that is deliberate: a duration the log refuses is a duration
  the grid must refuse too. `1,5h`, `1:30` and a bare `.5` are the same three
  mistakes wherever they are typed, and they get the same three sentences —
  which is what stops the grid from quietly accepting a figure a reader has
  already been told is ambiguous, and what keeps the one-day ceiling the same
  ceiling in both places.
*/
import { loggedMinutes } from "./form";

/**
 * One cell of the grid, submitted: the field it came from, the pair it is
 * about, and the duration as it was typed.
 *
 * The name is kept alongside the pair because that is what an error is keyed
 * under — the form renders its message beside the box, and the box is found by
 * its name. Parsing the pair back out at that point would be a second place
 * for the two to disagree.
 */
export type TypedBulkCell = {
  readonly name: string;
  readonly address: BulkCellAddress;
  /** What the reader typed, untrimmed. */
  readonly text: string;
};

/**
 * One cell ready to be written: a project, a day, and whole minutes.
 *
 * Nothing else, because a cell has nowhere to put anything else. A note and an
 * attribution both belong to a particular stretch of work, and a grid cell
 * stands for a day — so a bulk entry is project-level and unannotated, and
 * both are added afterwards from the project's own time list. Saying so here
 * is better than a grid with a second box in every cell that almost nobody
 * fills in.
 */
export type BulkTimeDraft = BulkCellAddress & {
  /** Whole minutes, as the column holds them. */
  readonly minutes: number;
};


/**
 * How much a cell's box will hold, which is the number the input carries as
 * its `maxLength`.
 *
 * A duration is short: `1h30m` is five characters and `0.25h` is five. Eight
 * leaves room for a space and a stray zero without leaving room for a
 * sentence — a cell is not a note, and a box that accepted forty characters
 * would invite one and then refuse it.
 *
 * Exported because the browser and the validator must agree. Two copies of a
 * limit drift, and the day they do the browser stops somebody at a length the
 * parser would have accepted.
 */
export const BULK_CELL_MAX_LENGTH = 8;

/**
 * What a cell's form field is called, before the project and the day are put
 * on it.
 *
 * A prefix rather than a bare pair, so a cell name cannot collide with a field
 * the form adds later for something that is not a cell. Exported because the
 * name is parsed as well as built, and a separator spelled twice is a separator
 * that drifts.
 */
export const BULK_CELL_PREFIX = "cell";

/**
 * What separates the three parts of a cell's name.
 *
 * A colon, because neither half it joins can contain one: an id is
 * `prefix_base36` and a calendar date is `YYYY-MM-DD`. That is what makes the
 * name parseable back into the pair it was built from, which the error list
 * needs in order to say which cell it is talking about.
 */
export const BULK_CELL_SEPARATOR = ":";

/** Which cell of the grid a typed duration belongs to. */
export type BulkCellAddress = {
  readonly projectId: string;
  /** The calendar date the column stands for: `YYYY-MM-DD`. */
  readonly workedOn: string;
};

/**
 * The form name for one cell of the grid.
 *
 * Derived from the pair rather than from the cell's position, because a
 * position is a fact about the screen: a project added in another tab would
 * shift every row below it, and a submission keyed by row index would then
 * land a week of work on the wrong engagements. The pair is what the entry is
 * actually about.
 */
export function bulkCellName(address: BulkCellAddress): string {
  return [
    BULK_CELL_PREFIX,
    address.projectId,
    address.workedOn,
  ].join(BULK_CELL_SEPARATOR);
}

/**
 * The pair a cell's name was built from, or null if the name is not one.
 *
 * The inverse of `bulkCellName`, and it has to be a true inverse: the per-cell
 * errors come back keyed by name, and the sentence that names the cell for a
 * reader is built from the pair. A name that round-tripped to a different day
 * would be a message pointing at the wrong column.
 *
 * Null rather than a throw for anything that is not a cell name. Nothing a
 * page renders produces one, so the only way here is a hand-built submission —
 * and the caller that asked is reporting on a form rather than running the
 * app's own arithmetic, so it needs an answer it can skip rather than an
 * exception.
 *
 * Split from the right, on exactly two separators. The project id cannot
 * contain one and neither can the date, so the shape is fixed; checking the
 * count rather than taking the first three parts is what refuses a name with
 * something extra tacked on instead of silently reading the front of it.
 */
export function parseBulkCellName(name: string): BulkCellAddress | null {
  const parts = name.split(BULK_CELL_SEPARATOR);
  if (parts.length !== 3) return null;

  const [prefix, projectId, workedOn] = parts;
  if (prefix !== BULK_CELL_PREFIX) return null;
  if (projectId === "" || workedOn === "") return null;
  return { projectId, workedOn };
}

/**
 * Every cell the grid offers, in the order it reads: a row at a time, Monday
 * to Sunday.
 *
 * This list is the whole of what a bulk submission may say, and that is the
 * point of building it rather than walking whatever arrived. A form is a POST
 * endpoint, so a submission can carry any field name at all — including a
 * project nobody was shown and a day in another week. The action reads exactly
 * these names out of the body and ignores the rest, which means an unknown
 * project or an out-of-week day is not a refusal to word but a field that was
 * never looked at.
 *
 * Grid order because it is the order errors are reported in and the order
 * entries are written in. A reader checking a list of problems against the
 * sheet in front of them reads down the rows, and an entry list whose
 * `createdAt` ties break in grid order reads the same way afterwards.
 */
export function bulkCellNames(
  projectIds: readonly string[],
  days: readonly string[],
): string[] {
  return projectIds.flatMap((projectId) =>
    days.map((workedOn) => bulkCellName({ projectId, workedOn })),
  );
}

/**
 * The cells a reader actually typed something into, in grid order.
 *
 * Almost every cell of a submitted sheet is blank, and a blank cell is an
 * answer rather than a mistake: it says no time went to that project on that
 * day. Treating it as a field that failed would mean a forty-cell grid coming
 * back with thirty-seven errors on it the first time anybody pressed Save.
 *
 * Whitespace counts as blank, so a stray space left in a box — a tab taken
 * through the grid, a half-typed figure deleted — is a cell nobody filled in
 * rather than a duration nobody can read.
 *
 * A name the parser refuses is skipped rather than reported. The caller builds
 * the list from the grid it rendered, so a name that does not parse is a bug
 * here rather than news for a reader; skipping keeps that from becoming an
 * error message beside a box that does not exist.
 */
export function typedBulkCells(
  names: readonly string[],
  fields: Readonly<Record<string, string>>,
): TypedBulkCell[] {
  const typed: TypedBulkCell[] = [];
  for (const name of names) {
    const text = fields[name] ?? "";
    if (text.trim() === "") continue;

    const address = parseBulkCellName(name);
    if (address === null) continue;
    typed.push({ name, address, text });
  }
  return typed;
}

/**
 * A submitted sheet, read: either every typed cell as a draft entry, or a
 * message for each cell that could not be read.
 *
 * All or nothing, and that is the whole reason the write is a transaction. A
 * press that wrote the nine cells it could read and reported three it could
 * not would leave a reader having to work out which nine landed before they
 * dared press again — and pressing again would duplicate those nine. One bad
 * cell stops the lot, the boxes keep what was typed, and the three messages
 * say what to fix.
 *
 * Errors are keyed by field name, which is what the form renders them beside.
 * They come out in grid order because that is the order `typedBulkCells`
 * walks: a reader checking the list against the sheet reads down the rows.
 *
 * Nothing here looks at what a cell already holds. A day that already has
 * twenty hours against it and gets eight more is a sheet worth questioning,
 * but every one of those entries is a readable duration somebody meant to
 * type, and refusing the ninth hour of a day one cell at a time is a form
 * arguing with a reader who can see the figures. Day 030 is where an
 * implausible day gets flagged, against the entries around it.
 */
export function parseBulkCells(
  names: readonly string[],
  fields: Readonly<Record<string, string>>,
): ParseResult<BulkTimeDraft[], string> {
  const drafts: BulkTimeDraft[] = [];
  const errors: Record<string, string> = {};

  for (const cell of typedBulkCells(names, fields)) {
    const minutes = loggedMinutes(cell.text);
    if (minutes.ok) {
      drafts.push({ ...cell.address, minutes: minutes.value });
    } else {
      errors[cell.name] = minutes.message;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: drafts };
}
