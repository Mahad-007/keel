/**
 * The one write the timesheet grid can ask for: a week of cells, saved
 * together.
 *
 * No `"use server"` at the top of this file, the same arrangement as the write
 * modules beside the project tabs. A `"use server"` module exports an endpoint
 * per function, POSTable with whatever arguments a caller likes — which here
 * would mean the list of cell names was part of the submission, and a list
 * that comes from the caller is no bound on the submission at all. The page
 * declares a closure around this and the compiler encrypts what it captured;
 * this stays a plain function taking the names as a parameter, which is what
 * makes it testable without a page.
 *
 * As everywhere else in the app so far, the capture says which page made the
 * call and not who was holding it. Phase 8 answers the second question from
 * the session.
 */

import { revalidatePath } from "next/cache";

import {
  createTimeEntries,
  type BulkTimeReason,
} from "@/lib/data/time-entries";
import { parseBulkCells } from "@/lib/time/bulk";
import {
  BULK_PROBLEMS,
  failedBulkState,
  readBulkFields,
  rejectedBulkState,
  savedBulkState,
  writtenBulkSheet,
  type BulkTimeState,
} from "@/lib/time/bulk-form";
import { TIMESHEET_PATH } from "@/lib/time/week-query";

/**
 * What a refusal from the data layer says to the reader.
 *
 * Exhaustive by its type, so a reason added to `createTimeEntries` is a
 * compile error here rather than a blank banner over a grid that did not save.
 *
 * `no-such-project` is the one that is really reachable: a timesheet names
 * every active engagement at once, so one closed down in another tab while the
 * sheet sat open is ordinary news. Its sentence says to reload, because the
 * row has gone with the project and there is nothing to try again.
 *
 * `no-entries` cannot happen from here — a sheet with nothing typed into it is
 * refused above, with a sentence that says what a blank cell means. If it ever
 * does, it is a bug in this file rather than anything a reader did, so it gets
 * the ordinary failure.
 */
const BULK_REFUSAL_PROBLEMS: Record<BulkTimeReason, string> = {
  "no-such-project": BULK_PROBLEMS.missingProject,
  "no-entries": BULK_PROBLEMS.failed,
};

/**
 * Saving a sheet: every cell a reader typed a duration into, written as one
 * entry each, in one transaction.
 *
 * `names` is the grid the page rendered — see the module comment. Only those
 * fields are read out of the body, so a submission naming a project that was
 * never on the sheet or a day outside the week is not refused with a sentence
 * about it; the field is simply never looked at, and the sheet that is saved
 * is the sheet somebody was shown.
 *
 * No redirect, and not even a changed URL. Writing up a week ends with
 * checking the figures that just appeared in the cells, so the page stays
 * where it is and is revalidated underneath: the boxes come back empty and the
 * durations are now in the totals above them.
 *
 * The order of the three refusals is the order of what a reader can do about
 * them. An unreadable cell is a message beside the box, so it comes first and
 * stops everything; a sheet with nothing in it is a press that asked for
 * nothing; and only then is anything written.
 */
export async function writeBulkTime(
  names: readonly string[],
  _previous: BulkTimeState,
  formData: FormData,
): Promise<BulkTimeState> {
  const fields = readBulkFields(formData, names);

  const parsed = parseBulkCells(names, fields);
  if (!parsed.ok) return rejectedBulkState(fields, parsed.errors);

  /*
    A press with every box empty. Not an error in any cell — a blank cell is an
    answer — so it belongs to the submission as a whole, and the sentence says
    what a blank cell means rather than only that nothing happened.
  */
  if (parsed.value.length === 0) {
    return failedBulkState(fields, BULK_PROBLEMS.nothingTyped);
  }

  /*
    A throw from here is the driver rather than the submission: a column guard
    this file's own parsing should have caught, or a transaction the database
    refused. The reader cannot act on either beyond pressing again, and the
    sentence they get is the one that matters — the whole sheet was one
    transaction, so nothing landed and a second press cannot duplicate
    anything.
  */
  let result;
  try {
    result = await createTimeEntries(parsed.value);
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeBulkTime: failed to save the sheet", error);
    return failedBulkState(fields, BULK_PROBLEMS.failed);
  }

  if (!result.ok) {
    return failedBulkState(fields, BULK_REFUSAL_PROBLEMS[result.reason]);
  }

  /*
    The figures are read off the page, so nothing in the cells changes until
    the sheet is re-rendered. The week is not in the path — it is a search
    param — and revalidating the path covers every week of it, which is what
    is wanted: a reader who steps back to the week they just filled in should
    not be served a cached sheet from before the press.
  */
  revalidatePath(TIMESHEET_PATH);

  return savedBulkState(writtenBulkSheet(result.entries), names);
}
