import type { ReactNode } from "react";

import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";
import { dayQualifiers, describeDay, type TimeDay } from "@/lib/time/days";

/**
 * One day of a time list: the date, what it came to, and the entries under it.
 *
 * Grouped by day because that is how time is read back. The question is never
 * "what is the ninth entry" — it is "what did Tuesday come to", and a flat
 * list of forty rows with a date repeated down the side makes the reader add
 * up a column to answer it.
 *
 * The date on the left and the figures on the right, with the day's own total
 * in the darker type and the qualifiers under it in smaller. That order
 * matters: the total is the figure being scanned down the page, and the
 * running total is the one consulted once, when the eye stops.
 *
 * A `<section>` with its own accessible name rather than a bare heading,
 * because the whole group is one thing to skip past or step into. The figures
 * are hidden from assistive technology and said in the name instead — read
 * aloud, three bare numbers in a row say almost nothing.
 */
export function TimeDayGroup({
  day,
  children,
}: {
  day: TimeDay;
  /** The day's entries, as rows. */
  children: ReactNode;
}) {
  const qualifiers = dayQualifiers(day);

  return (
    <section aria-label={describeDay(day)} className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {formatDate(day.workedOn)}
        </h4>
        <div aria-hidden="true" className="text-right">
          <p className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatMinutes(day.minutes)}
          </p>
          {/*
            Rendered only when there is something to qualify, so an ordinary
            day's heading is a date and one figure. The separator is a middle
            dot rather than two lines, because these are two short facts about
            one day and stacking them would make the heading taller than the
            rows under it.
          */}
          {qualifiers.length === 0 ? null : (
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {qualifiers.join(" · ")}
            </p>
          )}
        </div>
      </div>
      {/*
        `role="list"` on a list is normally redundant, and here it is not:
        Tailwind's reset takes the bullets off every list, and WebKit drops the
        list semantics along with them. The count is what it carries — how many
        stretches of work a day was broken into is part of reading the day.
      */}
      <ul role="list">{children}</ul>
    </section>
  );
}
