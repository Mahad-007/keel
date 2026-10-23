import { formatMinutes } from "@/lib/minutes";
import type { EstimateComparison } from "@/lib/time/rollup";

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

/**
 * What the comparison cell reads on a line nobody sized.
 *
 * It says there is no estimate rather than printing a dash, because a dash in
 * a column of judgements reads as a figure that failed to load. And it says
 * *compare* rather than "none", because the line is not missing data a reader
 * should go and type in — it is missing the one number this column divides
 * by, and the hours beside it are still perfectly real.
 */
export const NO_ESTIMATE_TO_COMPARE = "No estimate to compare";

/**
 * What the comparison cell reads on a finished line with no time against it.
 *
 * The arithmetic would say the line came in under by its whole estimate,
 * which is the most flattering sentence this table could produce and almost
 * never the true one. Work that was handed over took time; what has happened
 * is that the time was logged against the project, or against another line,
 * or not at all. Saying the estimate was beaten would turn a gap in the
 * record into a win.
 *
 * It is also the row that makes every other figure on the table suspect, so
 * it is worth naming rather than folding into "4h under" where a reader
 * scanning the column would never stop on it.
 */
export const DONE_WITH_NOTHING_LOGGED = "Marked done with nothing logged";

/**
 * What a line, or a whole project, has done to its estimate: the difference
 * and — where it adds anything — the share.
 *
 * Both in one cell rather than two columns, because they are one judgement
 * read at two scales and splitting them would put a mostly-empty column on
 * the table. A middle dot between them, the same separator a day heading uses
 * for its qualifying figures.
 *
 * The two refusals come first and in this order. No estimate means there is
 * nothing to say at all. A delivered line with no hours against it has
 * arithmetic that would say the wrong thing, so it is answered before the
 * arithmetic runs.
 *
 * `delivered` is a separate argument rather than a field, because a project
 * has no such thing — a project is never handed over, it is closed — and
 * inventing a field for it would invite a caller to ask whether this one is
 * done.
 */
export function describeAgainstEstimate(
  compared: EstimateComparison & { readonly loggedMinutes: number },
  delivered: boolean,
): string {
  if (compared.varianceMinutes === null) return NO_ESTIMATE_TO_COMPARE;
  if (delivered && compared.loggedMinutes === 0) {
    return DONE_WITH_NOTHING_LOGGED;
  }

  const variance = describeVariance(compared.varianceMinutes, delivered);
  const share = describeShare(compared.loggedShare);
  return share === null ? variance : `${variance} · ${share}`;
}
