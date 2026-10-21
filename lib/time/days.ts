import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";

/**
 * A project's time, gathered into the days it was worked.
 *
 * A time list is read a day at a time. The question behind it is never "what
 * is the ninth entry" — it is "what did Tuesday come to", and then "where has
 * the engagement got to". So the list is grouped, each day carries its own
 * total, and each day also carries the total of everything up to and including
 * it, which is the figure that answers the second question without the reader
 * adding up a column.
 *
 * Pure, and generic over the entry: the page passes whole rows and a test
 * passes four fields. Nothing here reads the database or the clock — the
 * grouping is arithmetic on the rows it is given, in the order it is given
 * them.
 */

/**
 * What grouping needs of a time entry, which is less than a row holds: who it
 * is, how long, which day, and whether it is chargeable.
 *
 * The note and the attribution are absent because no total is computed from
 * either. They are what the row on screen shows, and the functions here hand
 * the whole entry back rather than a copy of part of it, so a caller that
 * needs them still has them.
 */
export type LoggedEntry = {
  readonly id: string;
  readonly minutes: number;
  readonly workedOn: string;
  readonly billable: boolean;
};

/**
 * One day of a time list: the entries filed under it, and the three figures a
 * reader takes off the heading.
 *
 * `minutes` is the day. `billableMinutes` is how much of the day is meant to
 * be charged for, which is only worth saying when it differs — a day with an
 * unticked entry in it is a day whose total is not the figure that will reach
 * an invoice, and that is a thing to notice at the time rather than at the end
 * of the month.
 *
 * `runningMinutes` is everything on this day and every day before it. Before
 * rather than after, so the newest day — the one at the top of the list —
 * carries the total of the whole list, and a reader scanning downwards watches
 * it count back down towards the first day of the engagement.
 *
 * Running over the list it was given, which is not always the project: Day 028
 * filters by date range and by client, and the figure then means "of what is
 * shown". That is the honest reading of a running total in a filtered list,
 * and it is why the words beside it say "up to this day" rather than "spent so
 * far".
 */
export type TimeDay<T extends LoggedEntry = LoggedEntry> = {
  /** The calendar date the work was done on: `YYYY-MM-DD`. */
  readonly workedOn: string;
  /** Its entries, in the order they arrived in. */
  readonly entries: readonly T[];
  readonly minutes: number;
  readonly billableMinutes: number;
  readonly runningMinutes: number;
};

/**
 * What a set of entries comes to, in whole minutes.
 *
 * Integer addition, which is the whole reason time is minutes and not hours:
 * forty entries of twenty minutes add up to exactly 800, where forty values of
 * `0.3333` hours add up to something that has to be rounded before it can be
 * shown and rounds differently depending on where the rounding happens.
 *
 * An empty set comes to nothing, which is a real answer rather than a gap — a
 * day with no entries is not in the list at all, but a filtered list can hand
 * this an empty array and zero is what it has logged.
 */
export function totalMinutes(entries: readonly LoggedEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}

/**
 * How much of a set of entries is meant to be charged for.
 *
 * The non-chargeable ones are left out rather than subtracted, so an entry
 * whose flag is missing or unreadable — the column is an integer and a
 * hand-edited row can hold anything — counts as not chargeable. That is the
 * safe direction: an hour wrongly left out of this figure is still in the
 * list and still billable tomorrow, where an hour wrongly counted in is one
 * somebody marked free and got charged for.
 */
export function billableMinutes(entries: readonly LoggedEntry[]): number {
  return totalMinutes(entries.filter((entry) => entry.billable === true));
}

/**
 * The entries gathered into days, in the order the days first appear.
 *
 * The order is the caller's: the data layer hands back the newest work first,
 * so that is the order the days come out in and the order the list renders.
 * Nothing here sorts, because a list that re-sorted its input would quietly
 * disagree with whatever the query asked for — and Day 028 is going to ask for
 * ranges and orders this module has no opinion about.
 *
 * Entries sharing a day are gathered even when they are not next to each other
 * in the array. That cannot happen with the data layer's own ordering, and it
 * is cheap to be right about anyway: a day that appeared twice in the list
 * would show two headings with two totals, and neither would be the day's.
 *
 * `runningMinutes` is worked out from the calendar rather than from the
 * position in the array — every entry on this day or an earlier one. That is
 * what makes the figure the same whichever end of the list the caller handed
 * over, and it is the only reading that survives Day 028 turning the sort
 * around.
 */
export function groupTimeByDay<T extends LoggedEntry>(
  entries: readonly T[],
): TimeDay<T>[] {
  const byDay = new Map<string, T[]>();
  for (const entry of entries) {
    const day = byDay.get(entry.workedOn);
    if (day === undefined) byDay.set(entry.workedOn, [entry]);
    else day.push(entry);
  }

  /*
    The running total is accumulated over the days in calendar order, then read
    back off in whatever order the caller's list put them in. Two passes rather
    than a sum per day, so a project with two years of entries does not do
    quadratic work to draw one page.
  */
  const running = new Map<string, number>();
  let far = 0;
  for (const workedOn of [...byDay.keys()].sort()) {
    far += totalMinutes(byDay.get(workedOn) ?? []);
    running.set(workedOn, far);
  }

  return [...byDay].map(([workedOn, day]) => ({
    workedOn,
    entries: day,
    minutes: totalMinutes(day),
    billableMinutes: billableMinutes(day),
    runningMinutes: running.get(workedOn) ?? 0,
  }));
}

/**
 * What a day's heading says about the day: how long was logged, and how much
 * of it will not be charged for.
 *
 * The chargeable figure is only mentioned when it differs from the total,
 * which is almost never — time logged against a client engagement is
 * chargeable unless somebody says otherwise. Printing "4h 30m logged, 4h 30m
 * of it chargeable" on every day would be a clause that is always true and
 * therefore never read, and the one day it mattered would look like the rest.
 *
 * Said as what is *not* chargeable rather than what is, because that is the
 * part a reader is checking: the day's total is already in the sentence, and
 * the interesting figure is the gap between it and the invoice.
 */
export function describeDayTotal(day: TimeDay): string {
  const logged = `${formatMinutes(day.minutes)} logged`;
  if (day.billableMinutes === day.minutes) return logged;

  const free = day.minutes - day.billableMinutes;
  return `${logged}, ${formatMinutes(free)} of it not chargeable`;
}

/**
 * Whether the running total on this day says anything the day's own total has
 * not already said.
 *
 * On the oldest day in the list the two figures are the same number, because
 * there is nothing before it to add. Printing it twice side by side is the
 * kind of repetition that makes a reader stop trusting that the two columns
 * mean different things — so the earliest day shows one figure, and every day
 * above it shows both.
 *
 * Compared rather than worked out from the position in the list, so it is also
 * false on a list of one day and on a day whose predecessors happen to total
 * nothing.
 */
export function showsRunningTotal(day: TimeDay): boolean {
  return day.runningMinutes !== day.minutes;
}

/**
 * What the running figure is called, in the words that say which way it runs.
 *
 * "Up to this day" rather than "total" or "to date". The list is newest first,
 * so the figure beside the top day is the whole of it and the figure beside
 * the bottom day is one day's worth — a column labelled "total" would read as
 * four different totals of the same thing. And "to date" would be a claim
 * about today, which this is not: Day 028 filters the list, and then the
 * figure is of what is shown.
 */
export const RUNNING_TOTAL_LABEL = "up to this day";

/**
 * A day's heading as one sentence, for a reader who is not looking at the
 * figures laid out in a row.
 *
 * On screen the heading is a date on the left and two figures on the right,
 * which works because the columns repeat down the page and the eye learns them
 * once. Read aloud it is three numbers with nothing between them: "October
 * seventeen, four thirty, twelve forty-five" says almost nothing. So the group
 * carries this as its accessible name instead, and the figures themselves are
 * hidden from assistive technology rather than announced twice.
 *
 * The running total drops out of the sentence on the day where it would repeat
 * the day's own, the same rule the screen follows — hearing the same number
 * twice is worse than reading it twice.
 */
export function describeDay(day: TimeDay): string {
  const parts = [formatDate(day.workedOn), describeDayTotal(day)];
  if (showsRunningTotal(day)) {
    parts.push(`${formatMinutes(day.runningMinutes)} ${RUNNING_TOTAL_LABEL}`);
  }
  return parts.join(" — ");
}

/**
 * The line above a time list: how much work it holds, over how many days, and
 * what can be done to it.
 *
 * Three figures rather than one, because they answer different questions and a
 * reader wants all of them before scrolling. The entry count says how long the
 * list is. The day count says how spread out the work was — nine entries over
 * nine days is a retainer and nine entries over two days is a sprint, and the
 * list itself takes a lot of scrolling to tell them apart. The total is the one
 * figure the whole page is for.
 *
 * Saying where the controls are costs a clause and saves a hunt: they sit at
 * the end of each row, which is the last place a reader scanning a column of
 * durations would look.
 */
export function describeTimeList(days: readonly TimeDay[]): string {
  const entries = days.reduce((count, day) => count + day.entries.length, 0);
  if (entries === 0) return "No time logged against this project yet.";

  const total = formatMinutes(
    days.reduce((sum, day) => sum + day.minutes, 0),
  );
  const controls =
    entries === 1
      ? "It can be edited or deleted with the buttons beside it."
      : "Each can be edited or deleted with the buttons beside it.";

  if (entries === 1) return `One entry, ${total} in total. ${controls}`;
  if (days.length === 1) {
    return `${entries} entries on one day, ${total} in total. ${controls}`;
  }
  return `${entries} entries over ${days.length} days, ${total} in total. ${controls}`;
}
