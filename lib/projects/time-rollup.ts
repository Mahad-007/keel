import { formatMinutes } from "@/lib/minutes";

import { formatSharePercent } from "./scope-summary";

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

/**
 * What a line sitting exactly on its estimate says.
 *
 * It happens more often than the arithmetic suggests — half-hour estimates
 * and half-hour entries — and "0m over" would be a true sentence that nobody
 * reads as "this one is fine".
 */
export const ON_THE_ESTIMATE_LABEL = "On the estimate";

/**
 * A difference between logged and estimated time, in the words for its
 * direction.
 *
 * Three readings of one subtraction, and the third depends on something the
 * number cannot know. Over is over. Exactly on it has its own words. Under is
 * two different pieces of news: a line still open with an hour of its estimate
 * unspent has an hour *left*, and a line already handed over with an hour
 * unspent came in an hour *under*. The same figure, and a reader acting on it
 * would do opposite things — one is budget to spend and the other is budget
 * that was never needed.
 *
 * Done-ness is asked of the scope list's status rather than guessed from the
 * hours, which is the whole reason `rollUpDeliverable` carries it. Guessing
 * would mean a line was called finished because its estimate ran out, and
 * that is precisely the project this product exists to catch.
 *
 * The sign is taken off before formatting, because the direction is in the
 * word: "-1h left" would be read as an hour in deficit by anybody scanning a
 * column.
 */
export function describeVariance(
  varianceMinutes: number,
  delivered: boolean,
): string {
  if (varianceMinutes > 0) return `${formatMinutes(varianceMinutes)} over`;
  if (varianceMinutes === 0) return ON_THE_ESTIMATE_LABEL;
  const unspent = formatMinutes(-varianceMinutes);
  return delivered ? `${unspent} under` : `${unspent} left`;
}

/**
 * How much of the estimate has gone, as a percentage — or nothing at all,
 * when the percentage would only repeat the figure beside it.
 *
 * Three shares say nothing new. No share at all means there was no estimate
 * to take one of, which the cell has already said in words. Nought percent is
 * a line with nothing logged, which the logged column has already said.
 * Exactly one is a line on its estimate, which is what "On the estimate"
 * means. Printing those would put a number in every row and teach a reader to
 * stop looking at the column.
 *
 * Everywhere else it earns its place, because the difference alone cannot
 * scale: twenty minutes over is nothing on a forty-hour line and half as much
 * work again on a half-hour one, and 101% against 167% is the only part of
 * the row that says which.
 *
 * `formatSharePercent` rather than a second rounding written here, so the two
 * shares on a project page — the scope summary's delivered share and this one
 * — round the same way and treat the same near-misses the same.
 */
export function describeShare(share: number | null): string | null {
  if (share === null || share === 0 || share === 1) return null;
  return `${formatSharePercent(share)} of it`;
}
