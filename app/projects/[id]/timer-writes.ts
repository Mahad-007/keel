/**
 * The writes the running clock on a project's time tab can ask for.
 *
 * No `"use server"` at the top of this file, and that is the point — the same
 * reasoning as `time-writes.ts` and the write modules beside it. A
 * `"use server"` module exports an endpoint per function, each POSTable with
 * whatever arguments a caller likes, which would make `projectId` just another
 * field of the submission: a clock could be started against any engagement by
 * anybody who could reach the endpoint, and stopped into an entry on it. These
 * are plain functions, and the only registered references are the closures the
 * page declares around them, which capture the project encrypted. They still
 * take the project as a parameter, which is what makes them testable without a
 * page.
 *
 * As everywhere else, the capture says which page made the call and not who
 * was holding it. Phase 8 answers the second question from the session.
 */

import { revalidatePath } from "next/cache";

import {
  getActiveTimer,
  startActiveTimer,
  stopActiveTimer,
} from "@/lib/data/active-timers";
import { getDeliverable } from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import type { ActiveTimer } from "@/lib/db/schema";
import { projectPath } from "@/lib/projects/detail";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import {
  STOP_TIMER_PROBLEMS,
  stopTimerProblem,
  timerRunningTooLong,
  type StopTimerResult,
} from "@/lib/time/stop";
import {
  failedStartTimerState,
  parseStartTimerForm,
  readStartTimerDay,
  readStartTimerFields,
  rejectedStartTimerState,
  START_TIMER_PROBLEMS,
  startedTimerState,
  timerAlreadyRunning,
  type StartTimerState,
} from "@/lib/time/start";

/**
 * The title of the line a clock is running against, out of the list the page
 * rendered the picker from.
 *
 * Resolved against that list rather than by a query, so the line named in the
 * sentence afterwards is the line the picker offered. Null covers both "no
 * attribution" and "a line this page does not have", because the sentence says
 * the same thing for either: a clock against nothing in particular. The second
 * case is only reachable if the scope list changed between the render and the
 * press, and the page is about to be revalidated anyway.
 */
function titleOf(
  deliverableId: string | null,
  offered: readonly AttributableDeliverable[],
): string | null {
  if (deliverableId === null) return null;
  return offered.find((one) => one.id === deliverableId)?.title ?? null;
}

/**
 * Why the insert failed, as a sentence for the reader.
 *
 * The usual answer is "try again", and for a driver error that is the right
 * one. The exception is the attribution: `startActiveTimer` throws when the
 * deliverable has gone, and it goes between the check in front of the write
 * and the write itself more often than that sounds — a scope list being tidied
 * in another tab while a clock is started in this one. Telling that reader to
 * try again is telling them to retry something that cannot succeed.
 *
 * The same shape as `time-writes.ts`'s version, and for the same reason: the
 * read is not a diagnosis of the error — it cannot be, since a driver that
 * threw on the insert may throw on this too — so that case falls through to
 * the ordinary sentence.
 */
async function startFailureProblem(
  deliverableId: string | null,
): Promise<string> {
  if (deliverableId === null) return START_TIMER_PROBLEMS.failed;

  try {
    const deliverable = await getDeliverable(deliverableId);
    if (deliverable === null) {
      return START_TIMER_PROBLEMS.missingDeliverable;
    }
  } catch (error) {
    // Two failures in a row say nothing more than one did.
    console.error("writeTimerStart: could not read the deliverable", error);
  }
  return START_TIMER_PROBLEMS.failed;
}

/**
 * Starting the clock on one project.
 *
 * It does not redirect. The press replaces the form with the panel that holds
 * the running clock, both of which are on the tab the reader is already
 * looking at, and a navigation would scroll them away from the list they
 * started the work against.
 *
 * `offered` is the scope list the page rendered the picker from, passed in
 * rather than re-read here. That is what makes the attribution checkable
 * against the list somebody actually saw: a check against a fresh read would
 * accept a line added since the page was served, which is a line that was
 * never on the dropdown the press came from.
 */
export async function writeTimerStart(
  projectId: string,
  offered: readonly AttributableDeliverable[],
  _previous: StartTimerState,
  formData: FormData,
): Promise<StartTimerState> {
  const fields = readStartTimerFields(formData);

  const parsed = parseStartTimerForm(
    fields,
    readStartTimerDay(formData),
    offered.map((deliverable) => deliverable.id),
  );
  if (!parsed.ok) {
    return parsed.problem === null
      ? rejectedStartTimerState(fields, parsed.errors)
      : failedStartTimerState(fields, parsed.problem);
  }

  /*
    A clock on no project is refused by the foreign key anyway, inside the
    insert that would have written it, and the message it raises names a
    column. This one names the situation: the page has been open while the
    project was deleted somewhere else, and "try again" — what the failure
    below advises — is the one thing that will not work.
  */
  const project = await getProject(projectId);
  if (project === null) {
    return failedStartTimerState(fields, START_TIMER_PROBLEMS.missingProject);
  }

  let started;
  try {
    started = await startActiveTimer({ projectId, ...parsed.value });
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeTimerStart: failed to start the clock", error);
    return failedStartTimerState(
      fields,
      await startFailureProblem(parsed.value.deliverableId ?? null),
    );
  }

  if (!started.ok) {
    /*
      The refusal carries the running timer but not its project's name, and the
      name is the whole of what the reader needs. One extra read, only on the
      path where the press has already been refused — and the project's own
      name when the clock turns out to be on this one, which is the race where
      it was started on another device a moment ago.
    */
    const elsewhere =
      started.running.projectId === projectId
        ? project
        : await getProject(started.running.projectId);
    return failedStartTimerState(
      fields,
      timerAlreadyRunning(elsewhere?.name ?? "another project"),
    );
  }

  // The clock is read off the page, so nothing shows it until the page is
  // re-rendered.
  revalidatePath(projectPath(projectId));

  return startedTimerState({
    id: started.timer.id,
    deliverableTitle: titleOf(started.timer.deliverableId, offered),
    billable: started.timer.billable,
  });
}

/**
 * The running clock, if it is the one that press was aimed at and it belongs
 * to this project.
 *
 * The check is the whole point, and it is three checks in one read. The
 * project comes from the page's encrypted closure and the id comes from the
 * press, so comparing them is what stops a POST naming any timer in the
 * database and having it stopped into an entry on a project the caller chose.
 * The id has to match as well as the project, because a clock stopped and
 * another started since the page was drawn is a different stretch of work —
 * one somebody is in the middle of.
 *
 * Null for an id that is blank, stale, or on another engagement, because from
 * the reader's side those are one answer: the clock on the page in front of
 * them is not the clock that is running. Telling them which would be telling a
 * caller whether an id they guessed exists.
 */
async function projectTimer(
  projectId: string,
  id: string,
): Promise<ActiveTimer | null> {
  if (id === "") return null;

  const timer = await getActiveTimer();
  if (timer === null) return null;
  if (timer.id !== id || timer.projectId !== projectId) return null;
  return timer;
}

/**
 * Stopping the clock, which writes the stretch of work it measured.
 *
 * `new Date()` is read here, once, and handed to the write — which is what
 * makes the elapsed figure in the entry the figure this press decided on
 * rather than one the data layer worked out a moment later.
 *
 * `offered` is the scope list the page rendered, used only to name the line in
 * the sentence afterwards. The attribution itself is the timer's and is not
 * re-decided here: the clock was started against that line, and a press of
 * Stop is not an opportunity to change its mind.
 */
export async function writeTimerStop(
  projectId: string,
  offered: readonly AttributableDeliverable[],
  id: string,
): Promise<StopTimerResult> {
  const timer = await projectTimer(projectId, id);
  if (timer === null) return stopTimerProblem(STOP_TIMER_PROBLEMS.missing);

  let result;
  try {
    result = await stopActiveTimer(timer.id, new Date());
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeTimerStop: failed to stop the clock", error);
    return stopTimerProblem(STOP_TIMER_PROBLEMS.failed);
  }

  if (!result.ok) {
    if (result.refusal === "too-short") {
      return stopTimerProblem(STOP_TIMER_PROBLEMS.tooShort);
    }
    if (result.refusal === "too-long") {
      return stopTimerProblem(timerRunningTooLong(result.minutes));
    }
    /*
      `no-such-timer`: the clock went between the read above and the write —
      another tab, or a second press of the same button. The page is still
      revalidated, because the page is the thing that is out of date, but the
      reader is told, because unlike a deletion what they asked for did not
      happen: no entry was written and the minutes are gone.
    */
    revalidatePath(projectPath(projectId));
    return stopTimerProblem(STOP_TIMER_PROBLEMS.missing);
  }

  // The entry and the absent clock are both read off the page.
  revalidatePath(projectPath(projectId));

  return {
    ok: true,
    stopped: {
      id: result.entry.id,
      minutes: result.entry.minutes,
      workedOn: result.entry.workedOn,
      deliverableTitle: titleOf(result.entry.deliverableId, offered),
      billable: result.entry.billable,
    },
  };
}
