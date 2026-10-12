/**
 * The two presses a pasted scope list takes: read it, then write it.
 *
 * No `"use server"` at the top of this file, and that is the point — the same
 * reasoning as `scope-writes.ts` and `template-writes.ts`. A `"use server"`
 * module exports an endpoint per function, each POSTable with whatever
 * arguments a caller likes, which would make `projectId` just another field of
 * the submission. This is a plain function; the only registered reference is
 * the closure the page declares around it, which captures the project
 * encrypted. It still takes the project as a parameter, which is what makes it
 * testable without a page.
 *
 * As everywhere else, the capture says which page made the call and not who
 * was holding it. Phase 8 answers the second question from the session.
 */

import { revalidatePath } from "next/cache";

import {
  importDeliverables,
  listDeliverables,
  type ImportScopeReason,
} from "@/lib/data/deliverables";
import {
  IMPORT_PROBLEMS,
  importedScopeState,
  previewedPaste,
  previewedImportState,
  readImportFields,
  readImportIntent,
  readPreviewStamp,
  rejectedImportState,
  refusedImportState,
  type ImportScopeState,
} from "@/lib/deliverables/import-form";
import {
  canImport,
  importTextProblem,
  previewImport,
} from "@/lib/deliverables/import";
import { matchesFingerprint } from "@/lib/forms/fingerprint";
import { projectPath } from "@/lib/projects/detail";
import { totalEstimatedMinutes } from "@/lib/scope";

/**
 * The data layer answers with a code and the reader needs a sentence. The map
 * is exhaustive by its type, so a reason added to the data layer is a compile
 * error here rather than a blank message on a page.
 *
 * `no-lines` is unreachable from this form — a paste that reads as nothing is
 * refused before the write is called — but it is the honest sentence for it.
 */
const IMPORT_REASONS: Record<ImportScopeReason, string> = {
  "no-such-project": IMPORT_PROBLEMS.missingProject,
  "no-lines": IMPORT_PROBLEMS.nothingReadable,
};

/**
 * Reads a pasted scope list, or writes the one that has already been read.
 *
 * One function for both presses, because they are two steps of one
 * submission: the second has to arrive with the text the first was given, and
 * the only place that text lives between them is the box it was pasted into.
 *
 * Both presses re-read the paste from scratch. The preview is not kept on the
 * server between them — there is no session to keep it in, and a server that
 * remembered the last preview per project would hand one reader's paste to
 * another's press. What the commit press carries instead is a stamp of the
 * text it was shown, which is checked against the text it submitted.
 */
export async function writeScopeImport(
  projectId: string,
  _previous: ImportScopeState,
  formData: FormData,
): Promise<ImportScopeState> {
  const fields = readImportFields(formData);

  // Asked before the project is touched: an empty box, or a pasted document,
  // is a refusal about the text and costs no query to answer.
  const problem = importTextProblem(fields.lines);
  if (problem !== null) return rejectedImportState(fields, { lines: problem });

  /*
    The project's own titles, so the preview can say which pasted lines repeat
    something already agreed. Read fresh on both presses rather than captured
    by the page: a deliverable added in another tab since this page rendered is
    exactly the repeat a reader would want mentioned.
  */
  let agreed: readonly string[];
  try {
    agreed = (await listDeliverables(projectId)).map((row) => row.title);
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeScopeImport: could not read the scope list", error);
    return refusedImportState(fields, null, IMPORT_PROBLEMS.previewFailed);
  }

  const preview = previewImport(fields.lines, agreed);

  // The preview press writes nothing, which is the whole of its job.
  if (readImportIntent(formData) === "preview") {
    return previewedImportState(fields, preview);
  }

  /*
    From here on it is a commit press, and every refusal comes back carrying
    the preview that was just read — so the reader is never sent back to press
    Preview to see what they are being told about.
  */
  const shown = previewedPaste(fields.lines, preview);

  /*
    Is this the text that was previewed? A stamp that does not match means the
    box moved after the preview, which is the one thing a preview step exists
    to catch: committing it would write something nobody looked at. A blank
    stamp means nothing was previewed at all, which the form as rendered cannot
    produce — the Import button only exists under a preview — so it is a stale
    page or a hand-built POST, and it gets the preview it should have had.
  */
  const stamp = readPreviewStamp(formData);
  if (!matchesFingerprint(stamp, fields.lines)) {
    return refusedImportState(
      fields,
      shown,
      stamp.trim() === ""
        ? IMPORT_PROBLEMS.notPreviewed
        : IMPORT_PROBLEMS.changed,
    );
  }

  // All or nothing, decided where the paste was read rather than restated
  // here: one line that cannot be read stops the whole import.
  if (!canImport(preview)) {
    return refusedImportState(
      fields,
      shown,
      preview.problemCount > 0
        ? IMPORT_PROBLEMS.unreadableLines
        : IMPORT_PROBLEMS.nothingReadable,
    );
  }

  let result;
  try {
    result = await importDeliverables(projectId, preview.drafts);
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeScopeImport: failed to import the paste", error);
    return refusedImportState(fields, shown, IMPORT_PROBLEMS.failed);
  }

  if (!result.ok) {
    return refusedImportState(fields, shown, IMPORT_REASONS[result.reason]);
  }

  // The scope list, the summary above it and the duplicate control's count are
  // all part of the page, so none of them shows the new lines until it is
  // re-rendered.
  revalidatePath(projectPath(projectId));
  // The total comes from the rows as written rather than from the drafts, so
  // the sentence reports what is in the column and not what was asked for.
  return importedScopeState({
    deliverableIds: result.deliverables.map((row) => row.id),
    estimatedMinutes: totalEstimatedMinutes(result.deliverables),
  });
}
