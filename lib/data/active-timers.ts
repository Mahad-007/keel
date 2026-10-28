import { eq } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  activeTimers,
  type ActiveTimer,
  type TimeEntry,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import {
  elapsedMinutes,
  RUNNING_TIMER_SLOT,
  stoppedTimerEntry,
  timerStopObstacle,
  type TimerStopObstacle,
} from "@/lib/time/timer";

import { requireProject, requireProjectDeliverable } from "./belonging";
import { calendarDate, optionalText } from "./fields";
import { createTimeEntry } from "./time-entries";

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

/**
 * Throws the clock away and hands back the row it removed, or null if that
 * timer was not there.
 *
 * The way out of a mis-press, and it has to exist: Start, then the realisation
 * that it is the wrong project, and the alternative without this is to stop
 * the clock into an entry of a minute and then delete the entry. That leaves
 * two writes and a row in a list for whoever is reading it in the meantime.
 *
 * It writes nothing. A discarded timer leaves no trace, which is the one
 * decision here worth defending: the minutes it held are not a record of work,
 * they are a record of a button. The stretches of work that happened are in
 * `time_entries`, and a table of abandoned clocks would be a second place to
 * look for them with nothing in it worth finding.
 *
 * The id has to match, rather than this clearing whichever timer is running.
 * The press comes from a page that may have been open for an hour: the clock
 * it was looking at could have been stopped and another one started since, and
 * a discard that took "the running one" would throw away a stretch of work
 * somebody is in the middle of. Null is what says the page was stale.
 */
export async function discardActiveTimer(
  id: string,
  database: Database = db,
): Promise<ActiveTimer | null> {
  const [row] = await database
    .delete(activeTimers)
    .where(eq(activeTimers.id, id))
    .returning();
  return row ?? null;
}

/**
 * Why a clock was not stopped.
 *
 * `no-such-timer` is a stale page: the clock the press was aimed at has been
 * stopped or discarded since the page was drawn. The other two come from
 * `timerStopObstacle` and are about the elapsed figure rather than the row —
 * under a minute there is nothing worth writing, and past a day the figure is
 * a lie about which day the work happened on.
 *
 * Reusing the obstacle's own names rather than restating them, so a third
 * obstacle added to the arithmetic cannot be silently absent here.
 */
export type ActiveTimerStopRefusal = "no-such-timer" | TimerStopObstacle;

/**
 * The outcome of pressing Stop: the entry the clock became, or why it is
 * still running.
 *
 * The success carries all three things, which are three different facts that
 * the caller cannot work out from each other. The entry is the row that was
 * written, the timer is what it was written from — the attribution and the
 * note, for the sentence afterwards — and the minutes are the figure the two
 * agreed on.
 *
 * Both obstacle refusals carry the elapsed figure, because that figure is the
 * explanation: "this has been running for two days" is what makes the refusal
 * make sense, and a caller recomputing it a moment later would print a
 * different number from the one the refusal was decided on.
 */
export type ActiveTimerStop =
  | {
      readonly ok: true;
      readonly entry: TimeEntry;
      readonly stopped: ActiveTimer;
      readonly minutes: number;
    }
  | { readonly ok: false; readonly refusal: "no-such-timer" }
  | {
      readonly ok: false;
      readonly refusal: TimerStopObstacle;
      readonly minutes: number;
    };

/**
 * Stops the clock, writes the stretch of work it measured, and hands back
 * both — or says why the timer is still running.
 *
 * `now` is a parameter rather than read off the wall clock, which is what
 * makes the elapsed figure the same figure the caller has already shown. A
 * page that said "running for 25m" and an entry of 26 minutes would be two
 * answers to one question, and whichever a reader quoted at a client would be
 * the one that was wrong. It is also the only way to test this without
 * sleeping.
 *
 * The read, the insert and the delete are one immediate transaction. If they
 * were not, two presses of Stop would both find the timer and both write an
 * entry — the same stretch of work logged twice, which is the one duplicate on
 * this page that reaches an invoice. Immediate, so the lock is taken at BEGIN
 * rather than at the first write, and the loser of a race sees no timer rather
 * than a row it is about to delete twice.
 *
 * A refused figure leaves the clock running. That is the whole reason the
 * obstacles are checked here rather than being allowed to fail at the column:
 * a reader who presses Stop on a timer that has run for forty seconds has not
 * asked to throw the work away, and `discardActiveTimer` is the press that
 * says they have.
 *
 * The entry goes through `createTimeEntry` rather than being inserted here,
 * because there is one way to write a stretch of work and this is not a second
 * one. Every guard that function applies — the duration, the day, the
 * attribution belonging to the project — applies to a stopped clock too, and
 * the transaction is handed down so the entry and the removal are still one
 * write.
 */
export async function stopActiveTimer(
  id: string,
  now: Date,
  database: Database = db,
): Promise<ActiveTimerStop> {
  return database.transaction(
    async (tx) => {
      const [timer] = await tx
        .select()
        .from(activeTimers)
        .where(eq(activeTimers.id, id))
        .limit(1);
      if (!timer) return { ok: false, refusal: "no-such-timer" };

      const minutes = elapsedMinutes(timer.startedAt, now);
      const obstacle = timerStopObstacle(minutes);
      if (obstacle !== null) {
        return { ok: false, refusal: obstacle, minutes };
      }

      const entry = await createTimeEntry(
        { projectId: timer.projectId, ...stoppedTimerEntry(timer, minutes) },
        tx,
      );
      await tx.delete(activeTimers).where(eq(activeTimers.id, id));
      return { ok: true, entry, stopped: timer, minutes };
    },
    { behavior: "immediate" },
  );
}
