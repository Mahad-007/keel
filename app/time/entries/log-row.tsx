import Link from "next/link";

import type { TimeEntryWithNames } from "@/lib/data/time-entries";
import { formatMinutes } from "@/lib/minutes";
import { entryMarks, NO_NOTE_LABEL } from "@/lib/time/entry";
import {
  timeLogHref,
  withClient,
  withProject,
  type TimeLogQuery,
} from "@/lib/time/log-query";

/** Shared by the two cells that narrow the log, so they cannot drift apart. */
const NARROWING_LINK =
  "underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:decoration-zinc-700 dark:hover:text-zinc-100";

/**
 * One logged stretch of work, as a row of the log: how long, whose, and what
 * was done.
 *
 * The duration leads, in a column of its own and in tabular figures, because a
 * ledger is read down its numbers. The project and the client follow, which is
 * the fact the project page's own list never has to show and this one always
 * does — a filtered log holds four engagements at once, and a duration with no
 * engagement beside it is a figure nobody can act on.
 *
 * Both names are links that narrow the log rather than leaving it. That is the
 * drilling-down this page is for: a reader who spots an unexpected three hours
 * against Harbour Co clicks the name and has Harbour Co's time, with the date
 * range and the billing filter they already set still in force. Leaving for
 * the project page instead would throw the filters away, and the project page
 * already shows its own time.
 *
 * No controls. Editing an entry means knowing which project's scope it can be
 * attributed to, and that list is the project page's; a log across four
 * engagements would have to read four scope lists to render one picker. The
 * project link is the way to the form that can.
 */
export function LogRow({
  entry,
  query,
}: {
  entry: TimeEntryWithNames;
  /** The filters in force, so a narrowing link keeps the rest of them. */
  query: TimeLogQuery;
}) {
  const marks = entryMarks(entry);

  return (
    <tr className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
      <td className="w-20 py-2 pr-4 text-right align-baseline text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {formatMinutes(entry.minutes)}
      </td>
      <td className="py-2 pr-4 align-baseline text-sm text-zinc-700 dark:text-zinc-300">
        <Link
          href={timeLogHref(withProject(query, entry.projectId))}
          className={NARROWING_LINK}
        >
          {entry.projectName}
        </Link>
      </td>
      <td className="py-2 pr-4 align-baseline text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href={timeLogHref(withClient(query, entry.clientId))}
          className={NARROWING_LINK}
        >
          {entry.clientName}
        </Link>
      </td>
      <td className="py-2 align-baseline text-sm">
        {/*
          A note is allowed 500 characters and nothing makes them words, so a
          pasted URL or a run of hyphens would otherwise push the table wider
          than the page. Line breaks are kept: a note is sometimes the two or
          three things an afternoon went on.

          No note says so, in the colour the app uses for what is missing. The
          gap matters — a note is what an invoice line gets written from, and
          an entry without one is time nobody will be able to account for.
        */}
        {entry.note === null ? (
          <span className="text-zinc-400 dark:text-zinc-500">
            {NO_NOTE_LABEL}
          </span>
        ) : (
          <span className="whitespace-pre-line break-words leading-6 text-zinc-800 dark:text-zinc-200">
            {entry.note}
          </span>
        )}
        {marks.map((mark) => (
          /*
            Set a shade darker than the note beside it. A mark is the one thing
            on the row that changes what the time is worth, and the colour is
            the second way of telling — the word is the first.
          */
          <span
            key={mark}
            className="ml-2 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-300"
          >
            {mark}
          </span>
        ))}
      </td>
    </tr>
  );
}
