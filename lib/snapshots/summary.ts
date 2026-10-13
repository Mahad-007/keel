import {
  totalEstimatedMinutes,
  unestimatedCount,
  type EstimatedLine,
} from "@/lib/scope";

/**
 * What one snapshot is, as a list or a picker needs it.
 *
 * A project collects snapshots over an engagement — at signing, before a
 * change order, at the end — and the scope tab has to offer them on one line
 * each. That line answers two questions: when was this, and how big was the
 * scope list then. Both are needed: the dates say which moment, and the sizes
 * are what makes a reader notice the list has doubled before they have opened
 * the comparison at all.
 *
 * The totals come from `lib/scope.ts` rather than being summed again here, for
 * the reason the template summary gives: a snapshot is a scope list, and two
 * spellings of the same sum is how a picker and a panel end up disagreeing
 * about the same rows.
 */

/** A captured scope list's shape in numbers. */
export type SnapshotSize = {
  readonly lineCount: number;
  /** The whole captured list in whole minutes. Unsized lines add nothing. */
  readonly estimatedMinutes: number;
  /** How many lines were unsized, which says how far to trust the total. */
  readonly unestimatedCount: number;
};

/**
 * A snapshot's size worked out from its lines.
 *
 * The list query counts the same three figures in SQL, because a picker must
 * not read every line of every snapshot to label six options. This is the
 * definition those aggregates are held to — the same arrangement, and the same
 * round-trip test, as `templateSize`.
 */
export function snapshotSize(lines: readonly EstimatedLine[]): SnapshotSize {
  return {
    lineCount: lines.length,
    estimatedMinutes: totalEstimatedMinutes(lines),
    unestimatedCount: unestimatedCount(lines),
  };
}

/**
 * A snapshot as the picker and the comparison heading need it: when it was
 * taken, what it was called, what the project was agreed for then, and what
 * its scope list added up to.
 *
 * The size is flattened onto the row rather than nested, because that is the
 * shape one query can return — the counts are aggregates over the lines, and a
 * list that read every line of every snapshot to count them would read the
 * whole table to render one `<select>`.
 */
export type SummarisedSnapshot = SnapshotSize & {
  readonly id: string;
  /** What whoever took it called it, or null when they did not say. */
  readonly label: string | null;
  /** The moment the scope list was copied, as an ISO string. */
  readonly capturedAt: string;
  /** What the project was agreed for then, in cents. */
  readonly contractValueCents: number;
};
