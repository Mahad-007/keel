/**
 * The press that records a project's scope as it stands.
 *
 * No `"use server"` at the top of this file, and that is the point — the same
 * reasoning as `scope-writes.ts`, `template-writes.ts` and `import-writes.ts`.
 * A `"use server"` module exports an endpoint per function, each POSTable with
 * whatever arguments a caller likes, which would make `projectId` just another
 * field of the submission. This is a plain function; the only registered
 * reference is the closure the page declares around it, which captures the
 * project encrypted. It still takes the project as a parameter, which is what
 * makes it testable without a page.
 *
 * As everywhere else, the capture says which page made the call and not who
 * was holding it. Phase 8 answers the second question from the session.
 */

import { revalidatePath } from "next/cache";

import {
  captureScopeSnapshot,
  type SnapshotCaptureReason,
} from "@/lib/data/scope-snapshots";
import { projectPath } from "@/lib/projects/detail";
import {
  failedSnapshotState,
  parseSnapshotForm,
  readSnapshotFields,
  rejectedSnapshotState,
  SNAPSHOT_PROBLEMS,
  takenSnapshotState,
  type TakeSnapshotState,
} from "@/lib/snapshots/form";

/**
 * The data layer answers with a code and the reader needs a sentence. The map
 * is exhaustive by its type, so a reason added to the data layer is a compile
 * error here rather than a blank message on a page.
 */
const SNAPSHOT_REASONS: Record<SnapshotCaptureReason, string> = {
  "no-such-project": SNAPSHOT_PROBLEMS.missingProject,
  "empty-scope": SNAPSHOT_PROBLEMS.emptyScope,
  "unchanged-since": SNAPSHOT_PROBLEMS.unchangedSince,
  "unrecordable-scope": SNAPSHOT_PROBLEMS.unrecordableScope,
  "unrecordable-value": SNAPSHOT_PROBLEMS.unrecordableValue,
};

/**
 * Records a snapshot of the project's scope list and says what went into it.
 *
 * The label is checked before the project is touched, so a label somebody
 * pasted a paragraph into costs no round trip — and the reader gets it back in
 * the box rather than losing it to a refusal.
 *
 * Which lines are recorded is not this function's decision and is not in the
 * submission at all. The press means "record what is on the page now", and the
 * data layer reads the scope list inside the transaction that writes it, which
 * is the only way the record can be of a moment rather than of a page that was
 * rendered a while ago.
 */
export async function writeScopeSnapshot(
  projectId: string,
  _previous: TakeSnapshotState,
  formData: FormData,
): Promise<TakeSnapshotState> {
  const fields = readSnapshotFields(formData);
  const parsed = parseSnapshotForm(fields);
  if (!parsed.ok) return rejectedSnapshotState(fields, parsed.errors);

  let result;
  try {
    result = await captureScopeSnapshot(projectId, {
      label: parsed.value.label,
    });
  } catch (error) {
    // The reader cannot act on a driver error, but the logs should keep it.
    console.error("writeScopeSnapshot: could not record the snapshot", error);
    return failedSnapshotState(fields, SNAPSHOT_PROBLEMS.failed);
  }

  if (!result.ok) {
    return failedSnapshotState(fields, SNAPSHOT_REASONS[result.reason]);
  }

  // The snapshot picker and the comparison under it are both part of the page,
  // so neither shows the new snapshot until it is re-rendered.
  revalidatePath(projectPath(projectId));
  // The label comes off the row as written rather than off the submission, so
  // the sentence reports what is in the column — a label of only spaces was
  // stored as no label, and saying so is the honest answer.
  return takenSnapshotState({
    id: result.snapshot.id,
    label: result.snapshot.label,
    lineCount: result.lineCount,
  });
}
