
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

