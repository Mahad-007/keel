import type { ProjectionConfidence } from "@/lib/projection/confidence";

import type { ProjectProjection } from "./projection";

/**
 * The projection, in words a reader can act on.
 *
 * `lib/projection/` works out where a project lands and what is wrong with the
 * working. Every figure it produces is a number or a date, and not one of them
 * is a sentence — which is the gap this file closes, and the gap is wider here
 * than it was for any panel before it.
 *
 * A date is the most authoritative thing this app prints. "13 April 2026" does
 * not look like the output of two divisions over a fortnight of timesheet
 * rows, and it does not look conditional, and a reader who quotes it to a
 * client has staked something on arithmetic they could not see. So the words
 * do three jobs that the arithmetic cannot:
 *
 *   - They say the figures are an extrapolation, in the lead and not in a
 *     footnote. Every grade gets that sentence, including the best one.
 *   - They name each weakness with its own numbers in it, so a caveat is
 *     something to check or fix rather than a disclaimer to skim.
 *   - They say which pace the date came from, and what the other pace was. A
 *     reader who can see that the last fortnight ran at twice the average can
 *     decide for themselves how much the date is worth.
 *
 * Nothing is computed here beyond rounding for display. The figures are the
 * forecast's, the caveats are the confidence module's, and the one judgement
 * this file makes is which rows are worth drawing at all.
 */

/**
 * Whether the projected cost figures mean anything for this project.
 *
 * They need a scope list. With nothing in it the remaining work costs nothing,
 * so the projected final cost is the burn and the projected overage is
 * whatever has already been overspent — and a project with three months of
 * work ahead of it would read as expecting no overage at all. That is the one
 * place in this panel where a figure would be worse than a gap, because it is
 * wrong in the reassuring direction and looks like a measurement.
 *
 * The date the contract runs out survives, which is why the panel is still
 * drawn: it is worked out from the pace and the money, and neither of those
 * needs to know what the work is.
 *
 * Asked of the caveat rather than of the line count, so there is one place
 * that decides what an empty scope list means to a forecast and the sentence
 * explaining the gap cannot appear without the rows being withheld.
 */
export function hasProjectedCost(projection: ProjectProjection): boolean {
  return !projection.caveats.includes("no-scope");
}

/**
 * How much of the forecast to believe, in one word, for the corner of the
 * panel's heading.
 *
 * Deliberately not a colour and not a dot. The scope health banner has the
 * page's one coloured box and it earned it by reaching a verdict about the
 * project; this is a verdict about the *evidence*, which is a different kind
 * of thing and would be two amber boxes on one tab if it were drawn the same
 * way. A word in the heading is read on the way past, which is the only
 * attention this deserves — the caveats underneath are what matter.
 *
 * Capitalised as it is rendered, because it is a label rather than a sentence
 * fragment and nothing is prepended to it.
 */
export const CONFIDENCE_LABEL: Record<ProjectionConfidence, string> = {
  firm: "Firm basis",
  indicative: "Indicative",
  weak: "Weak basis",
};
