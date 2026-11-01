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
