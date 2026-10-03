import { formatMinutes } from "@/lib/minutes";

/**
 * What a scope list says about each line it shows.
 *
 * The sentences live here rather than in the component for the usual reason:
 * the distinction between an estimate of nothing and no estimate at all is a
 * rule about the data, and it is read in more than one place — the list, and
 * the scope summary Phase 2 ends with.
 */

/**
 * Zero minutes is not an estimate of zero. The column has no null, so a
 * deliverable nobody has sized stores a zero, and printing `0m` for it would
 * say the work is free — which is exactly the reading that makes a scope total
 * lie. The words say what is actually true: the number is missing.
 */
export const UNESTIMATED_LABEL = "Not estimated";

/**
 * Whether a deliverable has been sized at all. The predicate is exported so
 * that the list can set an unestimated line in the colour it sets missing
 * things in without re-deciding what missing means — two spellings of
 * `=== 0` is how a line ends up worded one way and coloured the other.
 */
export function isEstimated(minutes: number): boolean {
  return minutes !== 0;
}

export function describeEstimate(minutes: number): string {
  if (!isEstimated(minutes)) return UNESTIMATED_LABEL;
  return formatMinutes(minutes);
}

/**
 * The line above a scope list: how many lines there are, and that their order
 * is part of what was agreed.
 *
 * Worth saying once, because an ordered list on a page looks like a list
 * somebody sorted. This one is not sorted by anything — it is the sequence
 * the two parties wrote down, and Day 013 is where it gets rearranged.
 */
export function describeScopeList(count: number): string {
  if (count === 0) return "No deliverables agreed yet.";
  if (count === 1) return "One deliverable agreed so far.";
  return `${count} deliverables, in the order they were agreed.`;
}
