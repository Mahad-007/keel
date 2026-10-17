import { isEstimated } from "@/lib/deliverables/list";
import { formatMinutes } from "@/lib/minutes";

/**
 * Which line of scope a stretch of work went against, as a picker offers it.
 *
 * The question the picker is really asking is the one the whole scope-creep
 * phase is built on: *which* of the things we agreed did this hour go into.
 * Time with no attribution still counts against the project, so a reader who
 * skips the picker loses nothing they had — but time attributed to a line is
 * what lets Day 024 put six hours logged next to four hours estimated, which
 * is the comparison this product exists to make.
 *
 * Working out what each line reads as is arithmetic on a couple of strings,
 * and doing it here rather than inside the JSX is what makes it testable — the
 * same shape as the client picker and the template picker before it.
 */

export type DeliverableOption = {
  readonly id: string;
  /** What the option reads as, already disambiguated by its estimate. */
  readonly label: string;
};

/** What the picker needs of a deliverable, which is two of its columns. */
export type AttributableDeliverable = {
  readonly id: string;
  readonly title: string;
  readonly estimatedMinutes: number;
};

/**
 * One deliverable on one line: what it is, then what it was sized at.
 *
 * The estimate follows the title rather than leading it, because the title is
 * what the reader is scanning for. It is there at all because a `<select>`
 * collapses to the line that is chosen, and two lines of a scope list can
 * read alike — "Revision round" twice is ordinary, and the estimate is usually
 * what tells them apart.
 *
 * It also answers the question a reader is about to have anyway. Logging an
 * hour against a line estimated at two is a different act from logging it
 * against a line estimated at twenty minutes, and the picker is where that is
 * cheapest to notice.
 *
 * An unestimated line says so in words rather than showing `0m`, which would
 * read as a line sized at nothing — the same rule the scope list keeps, via
 * the same predicate, so the two cannot drift.
 */
export function deliverableOptionLabel(
  deliverable: AttributableDeliverable,
): string {
  const estimate = isEstimated(deliverable.estimatedMinutes)
    ? `${formatMinutes(deliverable.estimatedMinutes)} estimated`
    : "no estimate";
  return `${deliverable.title} · ${estimate}`;
}
