import { formatDate } from "@/lib/dates";
import { isWeekend, weekdayHeading } from "@/lib/time/week";

/**
 * One day's column heading: the weekday and the date, with the full date for
 * anybody who is not looking at the grid.
 *
 * The visible heading is as short as it can be — `Tue 27` — because it sits
 * above a narrow column and repeats seven times. Read aloud that is not
 * enough: a cell's whole meaning comes from the heading above it, and "Tue 27"
 * does not say which month, let alone which year. So the heading carries the
 * full date for assistive technology and hides the abbreviation from it,
 * rather than announcing both.
 *
 * Today's column is marked, because the most common reason to open a timesheet
 * is to fill in the day you are on and the grid gives no other clue which
 * column that is. The weekend is set back a shade for the reason `isWeekend`
 * gives: five of the seven columns are where the eye should land first.
 */
export function DayHeading({
  day,
  today,
}: {
  /** The calendar date this column is for: `YYYY-MM-DD`. */
  day: string;
  /** The reader's today, so one column can be marked as it. */
  today: string;
}) {
  const isToday = day === today;

  return (
    <th
      scope="col"
      aria-current={isToday ? "date" : undefined}
      className={`py-2 pr-4 text-right font-medium last:pr-0 ${
        isWeekend(day)
          ? "text-zinc-400 dark:text-zinc-600"
          : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      <span aria-hidden="true">{weekdayHeading(day)}</span>
      <span className="sr-only">
        {isToday ? `${formatDate(day)}, today` : formatDate(day)}
      </span>
      {isToday && (
        <span
          aria-hidden="true"
          className="block text-[10px] font-normal normal-case tracking-normal text-zinc-500 dark:text-zinc-400"
        >
          today
        </span>
      )}
    </th>
  );
}
