import { eq } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { activeTimers, type ActiveTimer } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { RUNNING_TIMER_SLOT } from "@/lib/time/timer";

import { requireProject, requireProjectDeliverable } from "./belonging";
import { calendarDate, optionalText } from "./fields";

/**
 * Data access for the `active_timers` table: the clock that is running right
 * now, if one is.
 *
 * Plain async functions with one optional database handle each, like every
 * other module here. What makes this one different is that the table holds at
 * most one row, so nothing takes a filter: there is no "list the timers" and
 * no "this project's timer". A reader either has a clock running or does not,
 * and the project is a fact about the row rather than a way of finding it.
 *
 * Three doors out of a running timer, and they are not variations on one.
 * Stopping it writes a time entry and removes the row — the ordinary end of a
 * stretch of work. Discarding it removes the row and writes nothing, which is
 * the way out of a mis-press. And a deleted project takes the row with it
 * through the cascade, writing nothing either, because there is no longer an
 * engagement for the minutes to count against.
 */

/**
 * What starting a clock needs: the project, and the day the entry it becomes
 * will be filed under.
 *
 * `startedOn` is required and has no default, for the reason
 * `NewTimeEntryInput.workedOn` has none: it is a calendar date, the server may
 * be most of a day away from the person pressing Start, and the only clock
 * that knows which day they mean is theirs. `startedAt` is the opposite — a
 * moment rather than a day, so the server's clock is the right one and it is
 * not an input at all.
 */
export type NewActiveTimerInput = {
  /** The engagement the work is being done for. Must already exist. */
  projectId: string;
  /**
   * The line of scope it is going against, if any. Must belong to the same
   * project. Absent and null both mean project-level work, which is a real
   * answer rather than a missing one.
   */
  deliverableId?: string | null;
  /** What is being done, in a person's words. Blank and absent store NULL. */
  note?: string | null;
  /** Defaults to true: time against a client engagement is chargeable. */
  billable?: boolean;
  /** The calendar date the entry will be filed under: `YYYY-MM-DD`. */
  startedOn: string;
};

/**
 * The timer that is running, or null if none is.
 *
 * Found by its slot rather than by reading the first row of the table, which
 * is the same question asked in a way that cannot be wrong: the slot is what
 * the unique index is on, so this is a lookup rather than a scan that trusts
 * the table to hold what it should.
 */
export async function getActiveTimer(
  database: Database = db,
): Promise<ActiveTimer | null> {
  const [row] = await database
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.slot, RUNNING_TIMER_SLOT))
    .limit(1);
  return row ?? null;
}

/**
 * Why a clock was not started.
 *
 * One refusal today, and a union rather than a boolean because it is the one
 * refusal a reader can act on: a timer is already running, so the way forward
 * is to stop that one. A code rather than a sentence, like every other refusal
 * in `lib/data/` — the words belong with the form that shows them, which is
 * the only place that knows whether the running clock is on this project or
 * another one.
 *
 * What is *not* here is a project that does not exist, or a deliverable
 * belonging to another engagement. Both throw: no page this app renders offers
 * either, so a call carrying one is a caller that built the form wrong, and a
 * refusal code exists to be turned into a sentence for somebody who did
 * nothing.
 */
export type ActiveTimerRefusal = "already-running";

/**
 * The outcome of pressing Start: the clock that is now running, or the one
 * that already was.
 *
 * The refusal carries the running timer rather than only the code, because
 * that row is the whole of what the reader needs to be told: which project the
 * clock they have forgotten about is on, and how long it has been going. A
 * caller that had to go and read it again could get a different answer from
 * the one this refusal was decided on.
 */
export type ActiveTimerStart =
  | { readonly ok: true; readonly timer: ActiveTimer }
  | {
      readonly ok: false;
      readonly refusal: ActiveTimerRefusal;
      readonly running: ActiveTimer;
    };

/**
 * Starts the clock and hands back the row, or the timer that was already
 * running.
 *
 * The read and the insert are one immediate transaction. A deferred one takes
 * no write lock until the insert, so two presses arriving together would both
 * find no timer and the second would be refused by the unique index — a thrown
 * constraint error where there is a perfectly good answer to give. Immediate
 * serialises them, so the second press sees the first press's row and comes
 * back as the refusal it is.
 *
 * The index is still the thing that makes "at most one" true, rather than this
 * function being careful. Anything that writes the table without going through
 * here — a migration, a hand-run statement, a second process — is refused by
 * the database rather than by a convention.
 *
 * Everything that can be checked without a query is checked first, so a
 * malformed day costs no round trip.
 */
export async function startActiveTimer(
  input: NewActiveTimerInput,
  database: Database = db,
): Promise<ActiveTimerStart> {
  const startedOn = calendarDate(input.startedOn, "timer started on");
  const note = optionalText(input.note);
  const deliverableId = optionalText(input.deliverableId);
  const billable = input.billable ?? true;

  const projectId = await requireProject(
    input.projectId,
    database,
    "timer project",
  );
  if (deliverableId !== null) {
    await requireProjectDeliverable(deliverableId, projectId, database);
  }

  return database.transaction(
    async (tx) => {
      const running = await getActiveTimer(tx);
      if (running !== null) {
        return { ok: false, refusal: "already-running", running };
      }

      const [row] = await tx
        .insert(activeTimers)
        .values({
          id: newId("tmr"),
          slot: RUNNING_TIMER_SLOT,
          projectId,
          deliverableId,
          note,
          billable,
          startedAt: new Date().toISOString(),
          startedOn,
        })
        .returning();
      return { ok: true, timer: row };
    },
    { behavior: "immediate" },
  );
}
