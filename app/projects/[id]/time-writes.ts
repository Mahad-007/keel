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

import { getProject } from "@/lib/data/projects";
import { createTimeEntry } from "@/lib/data/time-entries";
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
    return failedLogTimeState(fields, TIME_PROBLEMS.failed);
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
