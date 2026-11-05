import { EmptyPanel } from "@/components/empty-panel";
import { TIMESHEET_PATH } from "@/lib/time/week-query";

/**
 * No rows because no time has ever been logged.
 *
 * Its own state rather than an empty table, and the words go on what the log
 * is for: an empty ledger under five filter controls reads as a filter that
 * has gone wrong, when in fact there is nothing yet to filter. The way out is
 * the timesheet, because that is where a week gets filled in.
 */
export function NoTimeLogged() {
  return (
    <EmptyPanel
      heading="No time logged yet."
      action={{ href: TIMESHEET_PATH, label: "Open the timesheet" }}
    >
      <p>
        This is every stretch of work the studio has recorded, narrowed by the
        days it was done on, whose it was, and whether it is going on an
        invoice. Nothing has been logged, so there is nothing to narrow.
      </p>
      <p>
        Time is logged against a project — from its own page, or a week at a
        time on the timesheet.
      </p>
    </EmptyPanel>
  );
}

/**
 * No rows because the filters excluded all of them.
 *
 * Different news from having no time, and a different way out. An empty table
 * is ambiguous — it could mean there is no work, or it could mean the filters
 * are hiding all of it — and those call for completely different reactions, so
 * the panel says which one it is and offers the way back to everything.
 *
 * The filters themselves are not repeated here. The heading above the table
 * already names every one in force, and a panel that listed them again would
 * be the same sentence twice with the second one further from the controls
 * that set it.
 */
export function NoMatchingTime({ clearHref }: { clearHref: string }) {
  return (
    <EmptyPanel
      heading="No time matches these filters."
      action={{ href: clearHref, label: "Clear the filters" }}
    >
      <p>
        No entry falls inside every one of them at once. The filters are hiding
        the work, not standing in for the absence of it — widening the date
        range or going back to every client is usually what is wanted.
      </p>
      <p>
        A project&rsquo;s own page lists its time whether or not it matches
        anything here.
      </p>
    </EmptyPanel>
  );
}
