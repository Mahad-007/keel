import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";
import { deliverablesPhrase } from "@/lib/projects/scope-summary";
import {
  negativeEstimateCount,
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
  /**
   * How many lines carry an estimate below zero, which says whether to trust
   * the total at all.
   *
   * A snapshot copies what it found rather than repairing it, so a row
   * somebody wrote straight to the database is in here — and one line of minus
   * two hours against one of plus two leaves the total reading nought minutes
   * on a list where both lines are sized. The count is the only thing that
   * tells that apart from a list nobody had estimated.
   */
  readonly negativeEstimateCount: number;
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
    negativeEstimateCount: negativeEstimateCount(lines),
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

/**
 * What a captured scope list came to, on one line.
 *
 * The count leads, because it is the figure a reader compares between two
 * snapshots at a glance — a list that has gone from four lines to nine is the
 * thing worth noticing before any estimate is read. The total follows it.
 *
 * A list with nothing sized says so rather than claiming `0m`, the same lie a
 * zero estimate tells anywhere else in this app: no deliverable takes no time,
 * so a zero is a missing number.
 *
 * A list holding a negative line names the problem instead of printing the
 * sum, because neither reading of the sum is any use: minus two hours against
 * plus two comes to `0m`, which is how this label says "nobody sized it", and
 * a list that totals below zero reads as `-1h`, which reads as a broken page.
 * The figure is not repaired — the comparison underneath shows it as it
 * stands, and says which side holds the row — but a picker is three words
 * wide, and the useful three are that the total cannot be relied on.
 *
 * The template picker's label says nearly the same thing, and this is
 * deliberately not that function. Its separator is a middle dot because it
 * sits between a name and a size and nothing else; this one is read inside a
 * line that already has dots in it, after a label and a date, so its parts are
 * joined with commas. Sharing them would mean a separator argument, which is a
 * worse coupling than two short strings — the rule they both depend on, that a
 * zero is unsized, is `isEstimated`, and that is shared.
 */
export function snapshotSizeLabel(size: SnapshotSize): string {
  if (size.lineCount === 0) return "nothing agreed";

  const count = deliverablesPhrase(size.lineCount);
  /*
    Before the unsized branch rather than after it, though the two cannot both
    be true: a negative is not a zero, so a list with a negative line always
    has a sized one. Asked first because it is the stronger claim about the
    total, and an order that relied on them being exclusive would break the day
    one of the two definitions moved.
  */
  if (size.negativeEstimateCount > 0)
    return `${count}, estimates do not add up`;
  if (size.unestimatedCount >= size.lineCount)
    return `${count}, none estimated`;

  const total = formatMinutes(size.estimatedMinutes);
  if (size.unestimatedCount === 0) return `${count}, ${total}`;
  return `${count}, ${total}, ${size.unestimatedCount} not estimated`;
}

/**
 * When a snapshot was taken, and what it was called.
 *
 * The label leads when there is one, because that is what somebody chose to
 * call the moment and it is more use than the date: "Signed proposal" says why
 * the snapshot exists where "Oct 13" says only that it does. The date follows
 * it in either case, because it is the thing that cannot be ambiguous — two
 * snapshots may share a label, and the one taken this morning is not the one
 * taken in March.
 *
 * `formatDate` rather than the stored string, and a date rather than a time.
 * The hour a snapshot was taken is not a fact anybody argues about, and a
 * timestamp in a picker is a column of digits nobody reads.
 */
export function snapshotTakenLabel(snapshot: {
  label: string | null;
  capturedAt: string;
}): string {
  const taken = formatDate(snapshot.capturedAt);
  return snapshot.label === null ? taken : `${snapshot.label} · ${taken}`;
}
