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

/**
 * The first line of the picker, standing for time that went against no
 * particular deliverable.
 *
 * Not a placeholder, which is what the other pickers in the app put there. A
 * blank client on a project is a field somebody forgot; a blank deliverable on
 * a time entry is a fact about the work — the call, the invoicing, the
 * afternoon of email that the scope list has no line for. So the option says
 * what it means rather than "Choose a deliverable", and it is the one the
 * field starts on, because most time is logged in a hurry and the attribution
 * is the part a reader can add later.
 */
export const NO_DELIVERABLE_LABEL = "No deliverable — the project itself";

/**
 * The deliverables on offer, in the order the scope list reads in.
 *
 * Scope order rather than alphabetical or most-used, because that is the order
 * the reader has just been looking at on the tab next door: a picker that
 * re-sorts the list makes somebody hunt for the line they can picture the
 * position of.
 *
 * Every line is offered, including the ones marked done. Work arrives after a
 * deliverable is called finished more often than anybody would like — a
 * revision, a bug, a question — and that time belongs against the line it was
 * spent on. Hiding those would push it onto the project, where the comparison
 * Day 024 makes would quietly stop seeing it.
 */
export function deliverableOptions(
  deliverables: readonly AttributableDeliverable[],
): DeliverableOption[] {
  return deliverables.map((deliverable) => ({
    id: deliverable.id,
    label: deliverableOptionLabel(deliverable),
  }));
}
