import { exportLinkName } from "@/lib/time/export";
import { timeLogExportHref, type TimeLogQuery } from "@/lib/time/log-query";

/**
 * The link that hands the log on screen over as a CSV file.
 *
 * A plain `<a>` rather than a `Link`, which matters for two reasons. The
 * target is a file rather than a page, so there is no client-side navigation
 * to do — and `Link` prefetches what it points at, which here would mean
 * running the export's query on hover, once per link, for a file nobody has
 * asked for yet.
 *
 * No `download` attribute either. The response says `Content-Disposition:
 * attachment`, which is the server making the decision for every way of
 * reaching the URL rather than only for presses on this link.
 *
 * It sits in the header beside the way back out of the filters, because that
 * is where a reader looks once the list says what they wanted it to say.
 */
export function ExportLink({
  query,
  entries,
}: {
  /** The filters in force, so the file holds exactly what is on screen. */
  query: TimeLogQuery;
  /** How many rows are on screen, for the link's accessible name. */
  entries: number;
}) {
  return (
    <a
      href={timeLogExportHref(query)}
      aria-label={exportLinkName(entries)}
      className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      Export CSV
    </a>
  );
}
