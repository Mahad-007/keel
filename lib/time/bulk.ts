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
