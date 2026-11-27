/**
 * Filing rows under the project they name.
 *
 * Two studio-wide reads and a studio-wide repair all come back as one flat
 * list across every project, and every caller of one has the same next move:
 * walk it once and group it, rather than filtering it per project. A studio's
 * history is the one place in this app where the lists are long enough for the
 * difference between those to matter.
 *
 * Its own module, at the root of `lib/`, because the callers are a feature
 * module and the data layer and neither can sensibly import the other. Two
 * private copies is what was here before, and two copies of a grouping is two
 * chances for one of them to key on the wrong column.
 */

/**
 * Rows that each name a project, gathered by the project they name.
 *
 * One pass, so grouping a studio's history is linear rather than quadratic in
 * the number of projects.
 *
 * The order within each group is the order the rows arrived in, and the order
 * of the groups is the order the projects first appear. Both matter to a
 * caller: a scope list filed here still reads in the positions the two parties
 * agreed, and a repair that walks the groups writes projects in a settled
 * order, so an interrupted run has written whole projects rather than a
 * scatter.
 *
 * Generic over the row rather than over any one of the three shapes that use
 * it. The project id is the whole of what it reads, and asking for anything
 * else would make every caller build a row it has not got.
 */
export function groupByProject<T extends { readonly projectId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const mine = grouped.get(row.projectId);
    if (mine === undefined) grouped.set(row.projectId, [row]);
    else mine.push(row);
  }
  return grouped;
}
