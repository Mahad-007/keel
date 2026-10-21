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
