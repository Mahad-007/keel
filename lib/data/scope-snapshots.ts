import { db, type Database } from "@/lib/db";
import {
  scopeSnapshotLines,
  scopeSnapshots,
  type ScopeSnapshot,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import type { SnapshotLineDraft } from "@/lib/snapshots/capture";

import {
  optionalText,
  recordedMinutes,
  requiredText,
  wholeCents,
} from "./fields";

/**
 * Data access for the two snapshot tables: a project's scope as it stood at
 * one moment, and the lines it stood as.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a snapshot row — the same shape as
 * `deliverable-templates.ts`. Both tables live in one module because neither
 * is useful without the other: a snapshot with no lines records nothing, and a
 * line with no snapshot is dated to no moment at all, so every write here
 * touches both and does it in one transaction.
 *
 * Nothing here updates a row. A snapshot is a record of what was agreed, and a
 * record that can be brought into line with what is agreed now is worth
 * nothing — so there is no patch function, no `updatedAt`, and no door for one
 * to come in through later. The only writes are the capture itself.
 */

/**
 * What writing a snapshot needs: which project, what to call it, what the
 * project was agreed for at that moment, and the lines.
 *
 * `contractValueCents` is supplied rather than read off the project here, so
 * that the caller which read the scope list also supplies the price it was
 * read beside. The comparison is meaningless if the two come from different
 * instants, and a function that fetched the price itself would make that
 * mismatch invisible.
 */
export type NewScopeSnapshotInput = {
  /** The project whose scope this is a record of. Must already exist. */
  projectId: string;
  /** What the snapshot is, in a person's words. Blank and absent store NULL. */
  label?: string | null;
  /** What the project was agreed for at the captured moment, in cents. */
  contractValueCents: number;
  /** The lines, in the order they were agreed. At least one. */
  lines: readonly SnapshotLineDraft[];
};

/**
 * Writes a snapshot and its lines, and hands back the snapshot row.
 *
 * The two inserts are one transaction. A snapshot row whose lines failed to
 * write is worse than no snapshot at all: it would sit in the picker dated to
 * the right moment and compare as though every line of the project had been
 * added since.
 *
 * What is **not** checked here is the point of the function. A snapshot line's
 * title, description and status are written exactly as they were read, with no
 * trimming and no narrowing of the status — a deliverable's own columns were
 * guarded on the way in, so anything odd in them is a row somebody wrote by
 * hand, and that row is precisely what a record of the moment has to contain.
 * Repairing it here would make the comparison report a change the reader
 * cannot see, which is the one thing a diff must not do.
 *
 * The estimate goes through `recordedMinutes` rather than `wholeMinutes`: a
 * negative is recorded as it stands, and only a value too large to read back
 * is refused. The contract value keeps the ordinary `wholeCents` guard,
 * because it comes off the project column that has always had one.
 *
 * A snapshot with no lines is refused rather than stored, the same refusal
 * `createDeliverableTemplate` makes. It is the one shape of this table that
 * can say nothing: a comparison against it reports the whole scope list as
 * added, which is what the scope list already shows.
 */
export async function createScopeSnapshot(
  input: NewScopeSnapshotInput,
  database: Database = db,
): Promise<ScopeSnapshot> {
  const capturedAt = new Date().toISOString();
  const projectId = requiredText(input.projectId, "snapshot project");
  const label = optionalText(input.label);
  const contractValueCents = wholeCents(
    input.contractValueCents,
    "snapshot contract value",
  );

  if (input.lines.length === 0) {
    throw new Error("a scope snapshot needs at least one deliverable on it");
  }

  const snapshotId = newId("snp");
  const lines = input.lines.map((line, index) => ({
    // Its own prefix: an id in a log line should say whether it points at the
    // snapshot or at one of its lines.
    id: newId("sln"),
    snapshotId,
    deliverableId: line.deliverableId,
    title: line.title,
    description: line.description,
    estimatedMinutes: recordedMinutes(
      line.estimatedMinutes,
      "snapshot line estimate",
    ),
    status: line.status,
    sortOrder: index,
  }));

  return database.transaction(async (tx) => {
    const [snapshot] = await tx
      .insert(scopeSnapshots)
      .values({
        id: snapshotId,
        projectId,
        label,
        contractValueCents,
        capturedAt,
      })
      .returning();
    await tx.insert(scopeSnapshotLines).values(lines);
    return snapshot;
  });
}

