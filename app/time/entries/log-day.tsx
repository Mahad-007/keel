import type { ReactNode } from "react";

import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";
import { dayQualifiers, describeDay, type TimeDay } from "@/lib/time/days";

/**
 * One day of the log: a heading row with the date and what the day came to,
 * and the entries under it.
 *
 * A `<tbody>` per day rather than a date repeated down a column. The question
 * asked of a time list is never "what is the ninth entry" — it is "what did
 * Tuesday come to", and a flat list of forty rows makes a reader add up a
 * column to answer it. Grouping in the markup rather than visually also means
 * the day is one thing to skip past with a screen reader.
 *
 * `scope="rowgroup"` is what ties the heading to the rows beneath it, and the
 * figures are hidden from assistive technology and said in the heading's own
 * name instead: read aloud, three bare numbers in a row say almost nothing.
 *
 * The running total is "up to this day" and, on a filtered log, of what is
 * shown. `days.ts` says why that is the honest reading, and the label says so
 * in words rather than leaving a reader to assume it is the engagement's whole
 * cost.
 */
export function LogDay({
  day,
  columns,
  children,
}: {
  day: TimeDay;
  /** How wide the table is, so the heading row spans all of it. */
  columns: number;
  /** The day's entries, as rows. */
  children: ReactNode;
}) {
  const qualifiers = dayQualifiers(day);

  return (
    <tbody className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
      <tr>
        <th
          scope="rowgroup"
          colSpan={columns}
          aria-label={describeDay(day)}
          className="border-b border-zinc-200 pb-1.5 pt-5 text-left dark:border-zinc-800"
        >
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatDate(day.workedOn)}
            </span>
            <span aria-hidden="true" className="text-right">
              <span className="block text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatMinutes(day.minutes)}
              </span>
              {/*
                Only rendered when there is something to qualify, so an
                ordinary day's heading is a date and one figure. A middle dot
                between them rather than two lines, because these are short
                facts about one day and stacking them would make the heading
                taller than the rows under it.
              */}
              {qualifiers.length === 0 ? null : (
                <span className="block text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {qualifiers.join(" · ")}
                </span>
              )}
            </span>
          </span>
        </th>
      </tr>
      {children}
    </tbody>
  );
}
