import Link from "next/link";

import {
  describeWeek,
  nextWeek,
  previousWeek,
  weekOf,
  type Week,
} from "@/lib/time/week";
import { isCurrentWeek, timesheetHref } from "@/lib/time/week-query";

const LINK =
  "rounded px-2 py-1 text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

/**
 * The way between weeks: back, forward, and home to the week it is now.
 *
 * Links rather than buttons, because a week is a URL — the sheet somebody
 * pastes into a message. That also means the back button walks back through
 * the weeks a reader stepped through, which is what they will expect after
 * three presses of Previous.
 *
 * Each link says which week it goes to rather than only which direction. "Next
 * week" is ambiguous read out of context — next after the one you are looking
 * at, or next after today — and somebody four weeks back needs to know which.
 * The direction stays in the visible text because the dates are in the heading
 * above and a row of three date ranges would be three things to read.
 *
 * "This week" is marked current when it is where you already are, rather than
 * hidden or disabled. A link that disappears on one week in every fifty-two is
 * a control that moves, and the point of it is to be in the same place every
 * time.
 */
export function WeekNav({
  week,
  today,
}: {
  week: Week;
  /** The reader's today, which is what "this week" means. */
  today: string;
}) {
  const earlier = previousWeek(week);
  const later = nextWeek(week);
  const here = isCurrentWeek(week, today);
  const current = weekOf(today);

  return (
    <nav aria-label="Week" className="mt-4 flex items-center gap-1">
      <Link
        href={timesheetHref(earlier)}
        aria-label={`Previous week, ${describeWeek(earlier)}`}
        className={LINK}
      >
        Previous
      </Link>
      <Link
        href={timesheetHref(later)}
        aria-label={`Next week, ${describeWeek(later)}`}
        className={LINK}
      >
        Next
      </Link>
      <Link
        href={timesheetHref(current)}
        aria-current={here ? "page" : undefined}
        aria-label={here ? "This week, the one shown" : "This week"}
        className={
          here
            ? "rounded px-2 py-1 text-sm font-medium text-zinc-900 dark:text-zinc-100"
            : LINK
        }
      >
        This week
      </Link>
    </nav>
  );
}
