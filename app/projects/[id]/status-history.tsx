import { formatDate } from "@/lib/dates";
import type { ProjectStatusEvent } from "@/lib/db/schema";
import { describeStatusChange } from "@/lib/projects/transitions";

/**
 * Everything that has happened to this project's status, newest first.
 *
 * The header says what the project is now and since when. This is the part
 * that cannot be reconstructed from the row: that it was paused for two
 * months, that it was closed in March, that somebody reopened it in May and
 * wrote down why. It is the answer to the question a status column cannot
 * hold, which is the one that comes up when an invoice is argued about.
 *
 * An ordered list rather than a table: every row is one sentence and a date,
 * and a two-column table of those would be a table pretending the date is
 * something you scan down.
 */
export function StatusHistory({
  events,
}: {
  events: readonly ProjectStatusEvent[];
}) {
  if (events.length === 0) return <NoHistory />;

  return (
    <ol className="mt-3 flex flex-col">
      {events.map((event) => (
        <li
          key={event.id}
          className="border-b border-zinc-100 py-2.5 last:border-b-0 dark:border-zinc-900"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              {describeStatusChange(event.fromStatus, event.toStatus)}
            </p>
            {/*
              The machine-readable timestamp keeps the full moment while the
              text shows the day, which is the grain anybody reads a history
              at — two moves on the same afternoon are the same fact.
            */}
            <time
              dateTime={event.createdAt}
              className="shrink-0 text-sm tabular-nums text-zinc-500 dark:text-zinc-400"
            >
              {formatDate(event.createdAt)}
            </time>
          </div>
          {event.reason === null ? null : (
            <p className="mt-1 max-w-prose whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {event.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Every project gets an opening event when it is created, so an empty trail
 * means a row that predates this table rather than one nothing has happened
 * to. Saying which stops the reader looking for a bug in the history.
 */
function NoHistory() {
  return (
    <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
      Nothing recorded. This project was set up before its status was being
      tracked; everything from here on will be listed.
    </p>
  );
}
