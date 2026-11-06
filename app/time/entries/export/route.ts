import { listFilteredTimeEntries } from "@/lib/data/time-entries";
import { searchParamsRecord } from "@/lib/projects/query";
import { timeLogCsvResponse } from "@/lib/time/export-response";
import { logEntryFilter, parseTimeLogQuery } from "@/lib/time/log-query";

/**
 * The CSV export of the time log, at the log's own address with `/export` on
 * the end.
 *
 * A route handler rather than a server action, because what comes back is a
 * file rather than a page: a GET that answers with `Content-Disposition`
 * downloads, which means the export link is an ordinary link, needs no client
 * JavaScript, and the address a reader pastes into a message is the export
 * they were looking at.
 *
 * Three lines, and that is the point of the two modules it calls. The filters
 * are read by the same parser the page uses, from the same param names,
 * through the same translation into a data-layer filter — so the file holds
 * the rows the page showed rather than a second query's idea of them. What is
 * in the file and what the response says about it are settled in
 * `export-response.ts`, where they can be tested without a request.
 */

/**
 * Read at request time. Every filter comes off the URL and the answer is one
 * studio's ledger; a cached export is last week's figures under this week's
 * name.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const query = parseTimeLogQuery(
    searchParamsRecord(new URL(request.url).searchParams),
  );
  const entries = await listFilteredTimeEntries(logEntryFilter(query));
  return timeLogCsvResponse(entries, query);
}
