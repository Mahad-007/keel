import { formatMinutes } from "@/lib/minutes";

/**
 * The words a time rollup is read in.
 *
 * `lib/time/rollup.ts` works out what a project has logged against each line
 * of its scope; nothing in it knows what a figure is called, when a figure is
 * worth showing, or what a reader should conclude from it. That is this file:
 * a label, a cell, and — where the number alone would mislead — the sentence
 * that says how to read it.
 *
 * The sentences live here rather than in the panel for the reason the scope
 * summary's do: deciding that a line nobody estimated cannot be over its
 * estimate is a rule about the data, and a rule is testable where JSX is not.
 *
 * This is the first place in Keel where a figure is capable of being an
 * accusation. "6h logged against 4h estimated" is a sentence somebody takes
 * into a conversation with a client, so every cell here either says something
 * the arithmetic supports or says plainly that it cannot.
 */

/**
 * What the logged column says on a line nobody has put time against.
 *
 * "None yet" rather than `0m`, the same two words the scope summary puts on
 * nothing delivered. A duration of nought reads as a measurement — somebody
 * worked on this and it took no time — where the truth is an absence, and on
 * this table the absence is often the interesting part: an estimated line with
 * nothing against it three weeks in is the row to look at.
 */
export const NOTHING_LOGGED_LABEL = "None yet";

/**
 * A logged total as its cell reads.
 *
 * `formatMinutes` otherwise, so the column is exact durations a reader can
 * compare against the estimates beside them rather than decimal hours they
 * would have to convert.
 */
export function describeLogged(minutes: number): string {
  if (minutes === 0) return NOTHING_LOGGED_LABEL;
  return formatMinutes(minutes);
}
