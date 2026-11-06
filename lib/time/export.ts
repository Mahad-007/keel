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

import { csvDocument } from "@/lib/csv";
import { MINUTES_PER_HOUR } from "@/lib/minutes";

import { isBilled, isChargeable } from "./billing";

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

/**
 * Minutes as the decimal hours an invoice is written in: `90` becomes `1.50`.
 *
 * Two decimal places, because that is how an hourly figure is quoted and
 * multiplied — and because the column beside it holds the minutes exactly. A
 * twenty-minute entry exports as `0.33`, which is a third of an hour rounded,
 * and anyone adding the hours column of a long export will find it a few
 * minutes short of the minutes column. That is the trade: the Hours column is
 * for reading and for a rate, the Minutes column is for summing, and the
 * header says which is which.
 *
 * `toFixed` rather than `hoursInput`'s four places and trimmed zeros. That one
 * exists to round-trip through a form field; this one lines up in a column.
 */
export function exportHours(minutes: number): string {
  return (minutes / MINUTES_PER_HOUR).toFixed(2);
}

/**
 * A flag as a word: `Yes` or `No`.
 *
 * Not `TRUE`, which a spreadsheet turns into a boolean and will happily add
 * up, and not `1`, which it turns into a number — a column of those invites a
 * total that counts rows and reads as minutes. A word in the cell is a word.
 */
export function exportFlag(value: boolean): string {
  return value ? "Yes" : "No";
}

/**
 * One entry as a row of plain strings, in the order the header names.
 *
 * The strings are raw: a note holding a comma, a quote or a line break goes
 * through untouched, and `csvRow` is what makes it survive the file. Escaping
 * here as well would double it.
 *
 * `workedOn` goes out exactly as stored. It is already the `YYYY-MM-DD` a
 * spreadsheet parses as a date and sorts correctly, and formatting it for a
 * reader — `Oct 16, 2026` — produces a column that sorts alphabetically, which
 * puts April before January.
 *
 * The two flags go through the same predicates the rows on screen use, so an
 * entry marked not chargeable in the log cannot export as chargeable. `Billed`
 * is a yes or a no rather than the invoice's id: until Phase 6 there is no
 * invoice number worth printing, and an id a reader cannot look up is a column
 * of noise.
 *
 * A missing note is an empty cell. The log writes "No note" in the gap because
 * a person scanning a list needs the absence pointed out; a sheet does not —
 * filtering a column for blanks is how the same question gets asked there, and
 * it finds nothing if the blanks hold two words.
 */
export function timeEntryExportRow(entry: ExportableEntry): string[] {
  return [
    entry.workedOn,
    entry.clientName,
    entry.projectName,
    String(entry.minutes),
    exportHours(entry.minutes),
    exportFlag(isChargeable(entry)),
    exportFlag(isBilled(entry)),
    entry.note ?? "",
  ];
}

/**
 * The whole file: the header row, then one row per entry.
 *
 * The order is the query's — newest first, the same order the log is read in —
 * rather than oldest first or sorted by project. A file that came out in a
 * different order from the page it was exported from is one somebody has to
 * check against the page row by row, and anybody who wants it by project has a
 * spreadsheet that sorts.
 *
 * The header row is always written, so an export of a filter that matched
 * nothing is a file with its columns in it rather than an empty one. Opening
 * zero bytes tells a reader nothing about whether the export worked.
 */
export function timeLogCsv(entries: readonly ExportableEntry[]): string {
  return csvDocument([
    TIME_EXPORT_COLUMNS,
    ...entries.map((entry) => timeEntryExportRow(entry)),
  ]);
}

/**
 * What the export link is called when it is read aloud rather than looked at.
 *
 * The visible words are "Export CSV", which is all the room there is in a row
 * of header links and all a reader scanning the page needs. The accessible
 * name says how much is in it, because that is the question the link actually
 * raises: a reader who has set four filters is about to download something,
 * and "these 24 entries" is the confirmation that the filters are what the
 * file will hold.
 *
 * The count rather than the hours: it is the number of rows the file will
 * have, and the figures are already in the line above it.
 *
 * A log with nothing in it gets a sentence it can live without, because the
 * page does not offer the link at all — an export of no rows is a header row,
 * and a reader who downloads one learns nothing the empty page has not
 * already said.
 */
export function exportLinkName(entries: number): string {
  if (entries === 0) return "Export this log as CSV";
  const rows = entries === 1 ? "this one entry" : `these ${entries} entries`;
  return `Export ${rows} as CSV`;
}
