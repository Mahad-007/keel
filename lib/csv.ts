/**
 * CSV, as RFC 4180 writes it: comma-separated fields, CRLF between records,
 * and a quoted field when the text would otherwise break the row apart.
 *
 * The format looks like string joining and is not. A note holding a comma
 * silently becomes two columns; a note holding a line break becomes two rows,
 * which shifts every column of every row after it; a quote inside a quoted
 * field ends the field early. None of those fail loudly — they produce a file
 * that opens, and a ledger whose columns have slipped by one.
 *
 * So the escaping lives here, in one pure module with no idea what is being
 * exported, and the thing that knows about time entries hands it rows of
 * strings. That is what makes it testable against the cases that matter
 * rather than against the rows a studio happens to have.
 */

/** The separator. A comma, because that is what the format is named after. */
export const CSV_SEPARATOR = ",";

/**
 * The quote character, which is also its own escape: a quote inside a quoted
 * field is written twice. RFC 4180 has no backslash.
 */
export const CSV_QUOTE = '"';

/**
 * What ends a record: CRLF, which is what RFC 4180 says and what every
 * spreadsheet reads.
 *
 * A bare LF is read correctly by most things, and "most things" is the wrong
 * bar for a file somebody sends to an accountant. The cost is two bytes a row.
 */
export const CSV_ROW_END = "\r\n";

/**
 * The characters that force a field to be quoted: the separator, the quote
 * itself, and either half of a line ending.
 *
 * CR on its own as well as LF, because a note typed in a browser on Windows
 * can hold either, and a lone CR inside an unquoted field is still a record
 * boundary to a reader that splits on it.
 */
const MUST_QUOTE = /["\r\n,]/;

/**
 * Whether a field has to be quoted to survive the round trip.
 *
 * Asked rather than simply quoting everything, because an unquoted file is the
 * one a person can read in a terminal and diff — and the fields that need the
 * quotes are the minority: a date, a duration and a yes are three characters of
 * quotes each that say nothing.
 *
 * Leading or trailing whitespace counts. The RFC says spaces are part of the
 * field, and plenty of readers trim an unquoted one anyway; quoting is what
 * makes " Harbour Co" come back with its space, and the space is usually the
 * thing worth noticing about the name.
 */
export function needsCsvQuoting(value: string): boolean {
  if (MUST_QUOTE.test(value)) return true;
  return value !== value.trim();
}

/**
 * One field, ready to sit in a row: quoted if it has to be, with any quote
 * inside it doubled.
 *
 * Doubling is the whole of the escaping the format has. `Called it "the
 * rebuild"` becomes `"Called it ""the rebuild"""`, which looks wrong written
 * down and is exactly right: the outer pair delimit the field and each inner
 * pair is one quote.
 *
 * Line breaks are kept rather than flattened to a space. A note is sometimes
 * the three things an afternoon went on, written one to a line, and a quoted
 * field is allowed to hold them — the row still ends where the row ends. A
 * reader that cannot handle that is not reading CSV.
 */
export function csvField(value: string): string {
  if (!needsCsvQuoting(value)) return value;
  const doubled = value.replaceAll(CSV_QUOTE, CSV_QUOTE + CSV_QUOTE);
  return `${CSV_QUOTE}${doubled}${CSV_QUOTE}`;
}
