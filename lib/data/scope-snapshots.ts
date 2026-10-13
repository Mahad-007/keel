import type { SnapshotLineDraft } from "@/lib/snapshots/capture";

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
