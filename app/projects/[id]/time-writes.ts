/**
 * The writes a project's time tab can ask for.
 *
 * No `"use server"` at the top of this file, and that is the point — the same
 * reasoning as `scope-writes.ts` and the three write modules beside it. A
 * `"use server"` module exports an endpoint per function, each POSTable with
 * whatever arguments a caller likes, which would make `projectId` just another
 * field of the submission: an hour could be logged against any engagement by
 * anybody who could reach the endpoint. This is a plain function, and the only
 * registered reference is the closure the page declares around it, which
 * captures the project encrypted. It still takes the project as a parameter,
 * which is what makes it testable without a page.
 *
 * As everywhere else, the capture says which page made the call and not who
 * was holding it. Phase 8 answers the second question from the session.
 */

import { revalidatePath } from "next/cache";

import { getDeliverable } from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntry,
} from "@/lib/data/time-entries";
import type { TimeEntry } from "@/lib/db/schema";
import { projectPath } from "@/lib/projects/detail";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import {
  failedLogTimeState,
  loggedTimeState,
  parseLogTimeForm,
  readLogTimeFields,
  rejectedLogTimeState,
  TIME_PROBLEMS,
  type LogTimeState,
} from "@/lib/time/form";
import {
  DELETE_TIME_PROBLEMS,
  TIME_WRITE_DONE,
  timeWriteProblem,
  type TimeWriteResult,
} from "@/lib/time/remove";

/**
 * Why the insert failed, as a sentence for the reader.
 *
 * The usual answer is "try again", and for a driver error that is the right
 * one. The exception is the attribution: `createTimeEntry` throws when the
 * deliverable has gone, and it goes between the check in front of the write
 * and the write itself more often than that sounds — a scope list being
 * tidied in another tab while an hour is logged in this one. Telling that
 * reader to try again is telling them to retry something that cannot succeed.
 *
 * So the deliverable is read back, once, and only on the path where something
 * has already failed. A line that is gone is named; anything else is the
 * ordinary failure. The read is not a diagnosis of the error — it cannot be,
 * since a driver that threw on the insert may throw on this too — which is
 * why that case falls through to the same sentence as everything else.
 */
async function failureProblem(
  deliverableId: string | null | undefined,
): Promise<string> {
  if (deliverableId === null || deliverableId === undefined) {
    return TIME_PROBLEMS.failed;
  }

  try {
    const deliverable = await getDeliverable(deliverableId);
    if (deliverable === null) return TIME_PROBLEMS.missingDeliverable;
  } catch (error) {
    // Two failures in a row say nothing more than one did.
    console.error("writeTimeEntry: could not read the deliverable", error);
  }
  return TIME_PROBLEMS.failed;
}

/**
 * Logging one stretch of work against a project.
 *
 * Like the add line on the scope tab, it does not redirect. Time is written up
 * in a run — three stretches of the same Tuesday, one after another — and a
 * redirect per entry would reload the page and throw the cursor away every
 * time. So it returns a state, the form stays mounted, and the page is
 * revalidated under it.
 *
 * `offered` is the scope list the page rendered the picker from, passed in
 * rather than re-read here. That is what makes the attribution checkable
 * against the list somebody actually saw: a check against a fresh read would
 * accept a line added since the page was served, which is a line that was
 * never on the dropdown the submission came from.
 *
 * The title comes out of that same list for the sentence afterwards, so no
 * second query is needed to say which line the hour went against.
 */
export async function writeTimeEntry(
  projectId: string,
  offered: readonly AttributableDeliverable[],
  _previous: LogTimeState,
  formData: FormData,
): Promise<LogTimeState> {
  const fields = readLogTimeFields(formData);

  const parsed = parseLogTimeForm(
    fields,
    offered.map((deliverable) => deliverable.id),
  );
  if (!parsed.ok) return rejectedLogTimeState(fields, parsed.errors);

  /*
    An entry with no project is refused by the foreign key anyway, inside the
    insert that would have written it, and the message it raises names a
    column. This one names the situation: the page has been open while the
    project was deleted somewhere else, and "try again" — what the failure
    below advises — is the one thing that will not work.
  */
  const project = await getProject(projectId);
  if (project === null) {
    return failedLogTimeState(fields, TIME_PROBLEMS.missingProject);
  }

  let entry;
  try {
    entry = await createTimeEntry({ projectId, ...parsed.value });
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeTimeEntry: failed to log the time", error);
    return failedLogTimeState(
      fields,
      await failureProblem(parsed.value.deliverableId),
    );
  }

  // The entry is read back off the page, so nothing shows it until the page is
  // re-rendered.
  revalidatePath(projectPath(projectId));

  /*
    Reported from the row as written rather than from the submission. The
    duration is the minutes the column holds, so a reader who typed `0.6m` is
    told they logged a minute; the day is the trimmed date; and the attribution
    is whatever the row ended up with, which is null for a blank pick.
  */
  const attributed = offered.find(
    (deliverable) => deliverable.id === entry.deliverableId,
  );
  return loggedTimeState({
    id: entry.id,
    minutes: entry.minutes,
    workedOn: entry.workedOn,
    deliverableTitle: attributed?.title ?? null,
    billable: entry.billable,
  });
}

/**
 * The entry that press or submission was aimed at, if it is one of this
 * project's.
 *
 * The check is the whole point. The project comes from the page's encrypted
 * closure and the entry id comes from the submission, so comparing the two is
 * what stops a POST naming any entry in the database and having it edited or
 * deleted under cover of a page the caller was legitimately served. Without
 * it, every write below would act on whatever id arrived.
 *
 * Null for an id that is blank, unknown, or belongs elsewhere, because from
 * the reader's side those are one answer: the entry is not on the list in
 * front of them. Telling them which would be telling a caller whether an id
 * they guessed exists.
 *
 * As everywhere else in this file, this says which page made the call and not
 * who was holding it. Phase 8 answers the second question from the session.
 */
async function projectTimeEntry(
  projectId: string,
  id: string,
): Promise<TimeEntry | null> {
  if (id === "") return null;

  const entry = await getTimeEntry(id);
  if (entry === null || entry.projectId !== projectId) return null;
  return entry;
}

/**
 * Deleting one entry from a project's time list.
 *
 * The confirmation is not here, and it is worth saying why: it is a step in
 * the page, taken before this is ever called. A second check in the write
 * would be a second thing to get past rather than a second thing to think
 * about — the press that arrives here has already been made twice.
 *
 * The billed refusal *is* here, because it is not a confirmation. The row
 * hides its controls once an invoice has the time, so reaching that refusal
 * means the invoice was raised while the step sat open — and that reader
 * pressed Delete on an entry that was deletable a second earlier.
 */
export async function writeTimeEntryDelete(
  projectId: string,
  id: string,
): Promise<TimeWriteResult> {
  const entry = await projectTimeEntry(projectId, id);
  if (entry === null) return timeWriteProblem(DELETE_TIME_PROBLEMS.missing);

  let result;
  try {
    result = await deleteTimeEntry(entry.id);
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeTimeEntryDelete: failed to delete the entry", error);
    return timeWriteProblem(DELETE_TIME_PROBLEMS.failed);
  }

  if (!result.ok && result.refusal === "billed") {
    return timeWriteProblem(DELETE_TIME_PROBLEMS.billed);
  }

  /*
    Any other refusal is `no-such-entry`: it had already gone between the read
    above and the delete itself — somebody else, or a second press of the same
    button. That is not a problem to report, because what was asked for is
    true. The page is still revalidated, because it is the page that is out of
    date.
  */
  revalidatePath(projectPath(projectId));
  return TIME_WRITE_DONE;
}
