import { compareNames } from "@/lib/names";

import { riskBandRank } from "./band";
import type { PortfolioRow } from "./row";

/**
 * The order the portfolio reads in, worst first.
 *
 * A ranking is the whole of this page. A reader opens it to find out what to
 * do this week, and the answer is the top of the list — so the order has to be
 * defensible line by line, and every rung of it has to be a figure the row
 * itself prints. A sort nobody can reconstruct from what is on screen is the
 * coloured dot again, one dimension up.
 */

/**
 * A figure where more is worse, with "no figure at all" sorting last.
 *
 * Both of the numbers this page ranks on are nullable, and null does not mean
 * nought in either: a project with no readable share of its contract has not
 * consumed none of it, and a project with every line delivered has no gap
 * rather than a gap of nothing. Sorting an absence as a zero would put the
 * engagement nobody can measure in among the ones measured as fine.
 *
 * Last within its band rather than last overall, because the band has already
 * said how much the absence costs. Inside `unassessed` every row is null on
 * both figures, so this does nothing there and the comparison falls through to
 * the hours — which is the figure that means something about a project nothing
 * else could be read for.
 */
export function compareWorseFirst(
  left: number | null,
  right: number | null,
): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

/**
 * Which of two projects the portfolio puts first.
 *
 * Six rungs, and the first three are the ranking proper:
 *
 *   1. **The band.** `over` before `watch` before `unassessed` before
 *      `healthy`, which `riskBandRank` decides and argues for.
 *   2. **The share of the contract consumed, most first.** The money axis, and
 *      the one figure every assessed row has — the classifier withholds a
 *      verdict without it, which is what makes it primary here too. Inside
 *      `over`, this puts the engagement that has spent 160% of its price above
 *      the one that has spent 60% of it, which is the order somebody chasing a
 *      change order needs.
 *   3. **The gap between the burn and the delivery, widest first.** The
 *      delivery axis, and the tiebreak between two projects that have spent
 *      the same share. The one demonstrably outrunning its scope goes first;
 *      the one whose gap could not be read goes last, because a project with
 *      two axes read is better understood than a project with one.
 *
 * The last three are there to stop the list shuffling, and that matters more
 * than it sounds: a portfolio is read by scanning down it, and rows that swap
 * places between reloads are rows a reader loses their place in.
 *
 *   4. **Hours logged, most first.** The figure that ranks `unassessed`, where
 *      both shares are null by construction. Eighty unvalued hours is a bigger
 *      hole than twenty minutes of them, and it is the only exposure a project
 *      with no rate and no price can be measured by.
 *   5. **The client, then the project, by name.** `compareNames` as everywhere
 *      else, so two identical readings read alphabetically rather than in
 *      whatever order the query returned.
 *   6. **The id.** The last tiebreak, so two identically named projects for one
 *      client have a fixed order instead of swapping.
 */
export function compareRisk(left: PortfolioRow, right: PortfolioRow): number {
  const byBand = riskBandRank(left.band) - riskBandRank(right.band);
  if (byBand !== 0) return byBand;

  const byConsumed = compareWorseFirst(
    left.assessment.consumedShare,
    right.assessment.consumedShare,
  );
  if (byConsumed !== 0) return byConsumed;

  const byGap = compareWorseFirst(left.assessment.gap, right.assessment.gap);
  if (byGap !== 0) return byGap;

  const byHours = right.burn.loggedMinutes - left.burn.loggedMinutes;
  if (byHours !== 0) return byHours;

  const byClient = compareNames(
    left.project.clientName,
    right.project.clientName,
  );
  if (byClient !== 0) return byClient;

  const byProject = compareNames(left.project.name, right.project.name);
  if (byProject !== 0) return byProject;

  return compareNames(left.project.id, right.project.id);
}

/**
 * The rows in portfolio order, worst first.
 *
 * A copy rather than a sort in place, so a caller holding the list it read is
 * not handed it back rearranged. The page builds the rows and ranks them in
 * one breath, but the assembly below is tested against both, and a function
 * that mutated its argument would make the second of those tests depend on the
 * first having run.
 */
export function rankedPortfolio(
  rows: readonly PortfolioRow[],
): PortfolioRow[] {
  return [...rows].sort(compareRisk);
}
