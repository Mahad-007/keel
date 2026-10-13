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
