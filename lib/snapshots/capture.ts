import type { DeliverableStatus } from "@/lib/deliverables/status";

/**
 * Taking a project's scope list and turning it into the lines of a snapshot.
 *
 * The counterpart of `lib/templates/capture.ts`, and the decision is the
 * opposite one. A template drops everything that belongs to the engagement,
 * because it is going to be applied to a different one. A snapshot keeps
 * everything, because it is a photograph of this engagement: the id it pairs
 * on, the words as they read, the estimate as it stood, and the status the
 * work was in. Anything left out is a change the diff could never report.
 *
 * Pure, over plain fields, so what crosses over is decided once and can be
 * tested without a database.
 */

/**
 * What capturing a snapshot reads off a deliverable.
 *
 * A structural subset of the row rather than `Deliverable`, the same
 * arrangement as `ScopeLine` in `lib/scope.ts`: a test should be able to pass
 * five fields, and nothing here needs the project or the timestamps.
 *
 * The id is in it, which is the one field a template capture has no use for.
 * It is what the comparison pairs the two lists on — without it a retitled
 * deliverable is indistinguishable from one line dropped and another added.
 */
export type CapturedScopeLine = {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  status: DeliverableStatus;
};

/**
 * One line of a snapshot as it is about to be written.
 *
 * `deliverableId` rather than `id`, because the row this becomes has an id of
 * its own and the two must not be confused: one names the snapshot line, the
 * other names the deliverable it was copied from. The rename happens here,
 * where the copy does, rather than in the data layer — a field called `id` in
 * an insert is the field that ends up in the primary key.
 *
 * No position. The order is the list's rather than the line's, so the data
 * layer numbers them densely from zero as it writes, exactly as it does for a
 * template's lines.
 */
export type SnapshotLineDraft = {
  readonly deliverableId: string;
  readonly title: string;
  readonly description: string | null;
  readonly estimatedMinutes: number;
  readonly status: DeliverableStatus;
};

/**
 * A project's scope list as the lines of a snapshot.
 *
 * The order is preserved exactly, because the order is part of what was
 * agreed and the snapshot is a record of what was agreed. Nothing is
 * filtered: an unestimated line captures as a zero, because a deliverable
 * nobody has sized is still a promise that was made, and leaving it out would
 * make the snapshot smaller than the list it was taken from — and then show
 * up, later, as a line the diff calls new.
 *
 * Nothing is repaired either. A title with stray whitespace, an estimate below
 * zero, a status the app does not recognise: all of them copy across as they
 * are. A snapshot that tidied its input would be a record of something other
 * than what was on the page, which is the one thing it must not be.
 */
export function capturedSnapshotLines(
  deliverables: readonly CapturedScopeLine[],
): SnapshotLineDraft[] {
  return deliverables.map((deliverable) => ({
    deliverableId: deliverable.id,
    title: deliverable.title,
    description: deliverable.description,
    estimatedMinutes: deliverable.estimatedMinutes,
    status: deliverable.status,
  }));
}

/**
 * Whether two recorded scope lists hold the same deliverables in the same
 * order.
 *
 * The order is part of what a snapshot records — the lines are numbered as
 * they are written, and read back in that order — and it is the one thing
 * `diffScope` deliberately does not compare. That leaves a question only this
 * can answer: whether a press would record anything the last snapshot does not
 * already say. Without it, a scope list whose lines were reordered and nothing
 * else is refused as unchanged, and the agreed order can never be recorded
 * again after the first snapshot.
 *
 * The ids in sequence, rather than the positions they were stored under.
 * Deleting a line renumbers the ones after it, so two snapshots can hold 0,1,2
 * and 0,1,3 over the same promises in the same order — and a comparison of the
 * numbers would call that a change nobody made. What the record says is which
 * line comes before which.
 *
 * Two lists of different lengths are not in the same order, which is the
 * answer the one caller wants: a hand-written duplicate row is a snapshot the
 * capture cannot reproduce, and recording the list as it actually reads is
 * better than refusing because an unreproducible row matched.
 */
export function sameRecordedOrder(
  before: readonly { readonly deliverableId: string }[],
  after: readonly { readonly deliverableId: string }[],
): boolean {
  if (before.length !== after.length) return false;
  return before.every(
    (line, index) => line.deliverableId === after[index].deliverableId,
  );
}
