import type { TimeEntryWithNames } from "@/lib/data/time-entries";
import { groupTimeByDay } from "@/lib/time/days";
import type { TimeLogQuery } from "@/lib/time/log-query";

import { LogDay } from "./log-day";
import { LogRow } from "./log-row";

/** Duration, project, client, what was done. */
const COLUMNS = ["Duration", "Project", "Client", "What was done"] as const;

/**
 * The filtered time entries, as a table grouped by the day they were worked.
 *
 * A table rather than the list of sections the project page uses, because this
 * one has columns the project page does not need: across four engagements a
 * row has to say whose work it was, and two names and a duration laid out by
 * hand would not line up down the page. A ledger is read down its columns.
 *
 * The grouping is `groupTimeByDay`'s, which gathers the days in the order the
 * entries arrived in — the data layer's, newest first — and works each day's
 * running total out from the calendar rather than from the position in the
 * array. So the order of the days is the query's, and nothing here re-sorts
 * what the filters asked for.
 */
export function LogTable({
  entries,
  query,
}: {
  entries: readonly TimeEntryWithNames[];
  /** The filters in force, so a row's narrowing links keep the rest of them. */
  query: TimeLogQuery;
}) {
  const days = groupTimeByDay(entries);

  return (
    <table className="mt-2 w-full table-auto border-collapse">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-800">
          {COLUMNS.map((column) => (
            <th
              key={column}
              scope="col"
              className={`pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${
                column === "Duration" ? "pr-4 text-right" : "pr-4 text-left"
              }`}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      {days.map((day) => (
        <LogDay key={day.workedOn} day={day} columns={COLUMNS.length}>
          {day.entries.map((entry) => (
            <LogRow key={entry.id} entry={entry} query={query} />
          ))}
        </LogDay>
      ))}
    </table>
  );
}
