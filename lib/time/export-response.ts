/**
 * The CSV export as an HTTP response: the file, what it is called, and the
 * headers that make a browser save it rather than render it.
 *
 * Separate from the route handler so it can be tested without a database or a
 * request. The route's own job is then the two lines that cannot be tested
 * that way — parse the URL, ask the data layer — and everything a reader
 * actually receives is settled here.
 */

import { CSV_MEDIA_TYPE, UTF8_BOM } from "@/lib/csv";
import { attachmentDisposition } from "@/lib/download";

import { timeLogCsv, type ExportableEntry } from "./export";
import { timeLogFilename } from "./export-name";
import type { TimeLogQuery } from "./log-query";

/**
 * The filtered entries as a file the browser will save.
 *
 * The byte order mark goes on here rather than in `timeLogCsv`, because it is
 * a fact about the file and not about the format: Excel needs it to read the
 * bytes as UTF-8, and a formatter whose output started with an invisible
 * character would make every test of it skip one.
 *
 * `nosniff` because a note is free text and a browser that ignores the stated
 * type and guesses from the content is a browser that can decide a file of
 * commas is HTML. The attachment disposition makes that unlikely rather than
 * impossible, and the header costs one line.
 *
 * `no-store` rather than a short max-age. The file is one studio's ledger
 * narrowed to one question, the URL that produced it is a GET anybody can
 * replay, and a copy of it sitting in a shared cache is a copy nobody knows
 * is there. It also means pressing Export twice after changing a filter
 * downloads what was asked for the second time rather than what a cache kept
 * from the first.
 *
 * The query comes along only to name the file. Nothing is re-filtered here —
 * the entries are what the route already asked the data layer for, and a
 * second filter on this side could disagree with the first.
 */
export function timeLogCsvResponse(
  entries: readonly ExportableEntry[],
  query: TimeLogQuery,
): Response {
  return new Response(`${UTF8_BOM}${timeLogCsv(entries)}`, {
    headers: {
      "Content-Type": CSV_MEDIA_TYPE,
      "Content-Disposition": attachmentDisposition(timeLogFilename(query)),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
