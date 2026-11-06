/**
 * The filtered time log as a CSV file: which columns, in what order, and how
 * each value reads once a spreadsheet has it.
 *
 * What it is for is the conversation at the end of a month. The log on screen
 * answers "what did October come to"; this is what gets attached to the mail
 * that says so, dropped into the sheet the client's accounts team already
 * has, or pivoted by somebody who wants it by project rather than by day.
 *
 * Every decision here is about the second reader — the spreadsheet — rather
 * than the first:
 *
 *   - the date goes out as `2026-10-16`, not `Oct 16, 2026`, because one of
 *     those sorts and groups and the other is a label;
 *   - minutes go out as an integer, which is the column to sum, with decimal
 *     hours beside it for the invoice;
 *   - a missing note is an empty cell rather than the words the row shows,
 *     because "No note" is a sentence for a person and a value to a filter;
 *   - there is no totals row. A file whose last line is a total makes a liar
 *     of every `SUM` and every sort somebody runs on it afterwards, and the
 *     page the export came from already says what the log came to.
 *
 * Pure, over the rows the page has already read, and it never touches the
 * escaping: it hands `lib/csv.ts` rows of plain strings. So what a column
 * holds is tested here and what the format does to it is tested there.
 */

/**
 * The header row, which is also the order of every row under it.
 *
 * Date first because that is what the file gets sorted by; then who it was
 * for, widest first, so a sheet grouped by client reads down its left-hand
 * columns; then the figures; then the flags; then the note, last because it is
 * the only column with no width to it.
 *
 * There is no deliverable column, and its absence is deliberate rather than
 * forgotten: the log's query joins projects and clients, and naming the line
 * of scope an entry went against would mean a third join for a column the log
 * on screen does not show either. Day 031 onwards is where scope and time are
 * read together.
 */
export const TIME_EXPORT_COLUMNS = [
  "Date",
  "Client",
  "Project",
  "Minutes",
  "Hours",
  "Chargeable",
  "Billed",
  "Note",
] as const;

/**
 * What exporting one entry needs of it, which is what the log's own query
 * already hands back.
 *
 * Written as the fields rather than as `TimeEntryWithNames` so the formatter
 * can be tested without building a joined row — and so that the day a column
 * is added to the table, nothing here changes unless the export wants it.
 */
export type ExportableEntry = {
  /** The calendar date the work was done on: `YYYY-MM-DD`. */
  readonly workedOn: string;
  readonly clientName: string;
  readonly projectName: string;
  readonly minutes: number;
  readonly billable: boolean;
  readonly billedInvoiceId: string | null;
  /** What was done, in a person's words, or null when they did not say. */
  readonly note: string | null;
};
