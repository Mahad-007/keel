import type { ProjectScopeLine, ScopeLine } from "@/lib/scope";
import type { LoggedTotals, ProjectLoggedTotals } from "@/lib/time/rollup";

import { RISK_BANDS, type RiskBand } from "./band";
import { rankedPortfolio } from "./rank";
import { portfolioRow, type HealthProject, type PortfolioRow } from "./row";

/**
 * The whole portfolio, assembled from three studio-wide reads.
 *
 * The page holds a list of projects, a list of totals and a list of scope
 * lines, and every one of the last two is missing the projects it has nothing
 * to say about. Putting them back together is the one job here, and it is the
 * job worth having in a tested module: the expensive way to get it wrong is
 * silent on both sides of it — file a project's hours under the wrong id and
 * the engagement burning its budget reads as untouched while a quiet one reads
 * as over.
 */

/**
 * What a project with no time logged against it is valued at.
 *
 * Neither studio-wide read returns a row for a project it has nothing for —
 * `GROUP BY` has no group for a project nobody has logged against — so the
 * assembly supplies the absence rather than dropping the project. Dropping it
 * would be the wrong answer twice over: a brand-new engagement belongs on the
 * list, and so does one with a price, a scope list and nobody working on it.
 *
 * Frozen and shared rather than built per project, so a row cannot be handed a
 * totals object another row could have mutated.
 */
export const NO_TIME_LOGGED: LoggedTotals = Object.freeze({
  entryCount: 0,
  loggedMinutes: 0,
  billableMinutes: 0,
});

/**
 * Rows carrying a project id, filed under it.
 *
 * One pass over the list rather than a lookup per project, which is the
 * difference between assembling a portfolio in linear time and in quadratic.
 *
 * Many rows per project, which is why it is this and not a plain `Map` from
 * the id to the row: a scope list is as many lines as the two parties agreed,
 * and a totals row is one per project only because the query grouped it that
 * way. The two are indexed differently below for exactly that reason.
 *
 * The order within each group is the order the rows arrived in, so a scope
 * list filed here still reads in the positions the two parties agreed.
 */
export function groupByProject<T extends { readonly projectId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.projectId);
    if (group === undefined) grouped.set(row.projectId, [row]);
    else group.push(row);
  }
  return grouped;
}

/**
 * What a project with no scope list is assessed against: nothing agreed.
 *
 * The scope read's counterpart to `NO_TIME_LOGGED`, and frozen for the same
 * reason — every project without a list is handed the same array, and one that
 * could be pushed to would give a project somebody else's deliverables.
 */
const NO_SCOPE_AGREED: readonly ScopeLine[] = Object.freeze([]);

/**
 * The portfolio: every project given, assessed and ranked worst first.
 *
 * Takes the projects rather than deciding which ones to show. Which projects
 * belong on this page is a question about the studio — the active ones — and
 * it is answered by the query, where it can be answered in SQL. A filter here
 * would be a second opinion about it, applied after the rows had been read.
 *
 * Totals and lines are matched by id and default to nothing, so a project
 * neither read mentions is still ranked: it comes out as nothing burned
 * against whatever it was agreed for, which is what it is.
 *
 * Totals and lines naming a project that is not in the list are ignored,
 * along with everything in them. The page passes every active project and
 * every project's time, so that is the ordinary case rather than an error —
 * a closed engagement's hours have no row to go in, and a portfolio that
 * invented one would be listing the projects it was asked to leave out.
 */
export function buildPortfolio(
  projects: readonly HealthProject[],
  totals: readonly ProjectLoggedTotals[],
  lines: readonly ProjectScopeLine[],
): PortfolioRow[] {
  /*
    One row per project, so a plain index rather than a grouping. A second row
    for the same project cannot come out of a `GROUP BY` on its id; if one ever
    did, the later would win, which is the same thing a grouping's first-wins
    would be — arbitrary — and not worth a branch that cannot be reached.
  */
  const totalsByProject = new Map(
    totals.map((total) => [total.projectId, total] as const),
  );
  const linesByProject = groupByProject(lines);

  return rankedPortfolio(
    projects.map((project) =>
      portfolioRow(
        project,
        totalsByProject.get(project.id) ?? NO_TIME_LOGGED,
        linesByProject.get(project.id) ?? NO_SCOPE_AGREED,
      ),
    ),
  );
}

/**
 * How many rows sit in each band.
 *
 * Every band is present, even at nought, so a caller reading one does not have
 * to tell a band with nothing in it from a band it has misspelled. The same
 * arrangement `countProjectsByStatus` makes, and for the same reason.
 *
 * Built off `RISK_BANDS`, so a fifth band is counted the day it is added
 * rather than the day somebody notices it was left out of a summary.
 */
export function countByBand(
  rows: readonly PortfolioRow[],
): Record<RiskBand, number> {
  const counts = Object.fromEntries(
    RISK_BANDS.map((band) => [band, 0]),
  ) as Record<RiskBand, number>;

  for (const row of rows) counts[row.band] += 1;
  return counts;
}
