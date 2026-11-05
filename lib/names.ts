/**
 * How two names of the same kind compare in a list: by case, or rather
 * without it.
 *
 * Lowercased before comparing, which is what `listClients` does in SQL for the
 * same reason — `Zephyr` sorting above `acme` is a list that looks broken. The
 * raw values break the tie afterwards so that two names differing only in case
 * still have a fixed order instead of swapping between renders.
 *
 * Its own module because three lists order by a name and they have to agree:
 * the timesheet's rows, the time log's project picker, and whatever Phase 6
 * lists an invoice's lines by. A picker sorted differently from the list it
 * stands for is a picker people scroll twice.
 */
export function compareNames(left: string, right: string): number {
  const folded = left.toLowerCase().localeCompare(right.toLowerCase());
  if (folded !== 0) return folded;
  return left < right ? -1 : left > right ? 1 : 0;
}
