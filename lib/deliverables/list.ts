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

export function describeEstimate(minutes: number): string {
  if (minutes === 0) return UNESTIMATED_LABEL;
  return formatMinutes(minutes);
}
