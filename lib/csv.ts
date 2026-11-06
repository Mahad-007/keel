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
 * The characters a spreadsheet reads as the start of a formula rather than as
 * text.
 *
 * `=` and `+` are the two everybody knows. `-` is there because `-1+1` is
 * arithmetic to Excel, and `@` because it introduces a function name. A
 * leading tab or carriage return is on the list because the old DDE path
 * skipped them before looking for the sign, so `\t=cmd|…` was the way round a
 * guard that only checked the first character.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Whether a field would be read as a formula by the thing most likely to open
 * this file.
 *
 * Not a CSV question at all — the RFC has nothing to say about it, and a field
 * reading `=1+1` round-trips perfectly. It is a question about the consumer:
 * open the file in Excel or Sheets and that cell is evaluated, and a note
 * reading `=HYPERLINK(...)` or worse was typed by somebody who could type it
 * into this app's notes field.
 */
export function startsCsvFormula(value: string): boolean {
  return FORMULA_START.test(value);
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
 *
 * The formula guard goes on first — an apostrophe in front, which holds the
 * cell as text — so a field that starts with a sign is safe whether or not it
 * also needed quoting. Every field goes through it rather than only the
 * free-text ones: a caller that had to decide which of its columns were safe
 * is a caller that will one day add a column and decide wrong.
 *
 * The cost of the apostrophe is visible and worth stating plainly: a note
 * reading `-2h, see email` exports as `'-2h, see email`, and the apostrophe is
 * in the cell. The alternative is a spreadsheet that runs a client's text, and
 * quoting does not help — `"=1+1"` is a quoted CSV field and still an
 * evaluated cell.
 */
export function csvField(value: string): string {
  const text = startsCsvFormula(value) ? `'${value}` : value;
  if (!needsCsvQuoting(text)) return text;
  const doubled = text.replaceAll(CSV_QUOTE, CSV_QUOTE + CSV_QUOTE);
  return `${CSV_QUOTE}${doubled}${CSV_QUOTE}`;
}

/**
 * One record: every field escaped, joined by the separator.
 *
 * It takes the fields already stringified, which is deliberate. How a duration
 * or a flag reads in a spreadsheet is a decision about the export rather than
 * about the format — whether minutes go out as `90` or `1h 30m` changes
 * whether a column can be summed — and this module has no business making it.
 *
 * No line ending. A row is a row; `csvDocument` is what puts them in a file.
 */
export function csvRow(fields: readonly string[]): string {
  return fields.map(csvField).join(CSV_SEPARATOR);
}

/**
 * Rows into a file: each record escaped, each ended with CRLF.
 *
 * Every row is terminated, the last one included. RFC 4180 allows either, and
 * terminating all of them is what makes the file a clean set of lines — `wc
 * -l` counts what a reader counts, two exports concatenate without welding
 * the last row of one to the first of the other, and a diff of two exports
 * shows the rows that changed rather than one long last line.
 *
 * No rows is an empty string rather than a lone newline, which is the honest
 * answer: a file with nothing in it. Whether an export should ever be empty is
 * the caller's question — the time log's answer is its header row, which is
 * one row rather than none.
 */
export function csvDocument(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => `${csvRow(row)}${CSV_ROW_END}`).join("");
}

/**
 * What a CSV response says it is.
 *
 * The charset is spelled out rather than left to the default, which for
 * `text/*` is US-ASCII in the oldest reading and the browser's guess in
 * practice. A client called Ångström has a name that is UTF-8 on the way out,
 * and a guessed encoding is how it arrives as mojibake.
 */
export const CSV_MEDIA_TYPE = "text/csv; charset=utf-8";

/**
 * The byte order mark, which is what makes Excel read the file as UTF-8.
 *
 * Excel ignores the charset on the response — it is reading a file off disk by
 * then — and without the mark it decodes a CSV in the machine's local
 * codepage. A client's name comes out mangled, which looks like the app
 * mangled it.
 *
 * Not part of `csvDocument`, because it is a fact about the file rather than
 * about the format: the mark is not a field, not a row, and a test of the
 * formatter that had to skip three bytes to read the header row would be a
 * test of the wrong thing.
 */
export const UTF8_BOM = "﻿";
