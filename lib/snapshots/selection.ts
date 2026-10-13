import { projectTabHref } from "@/lib/projects/detail";
import { firstParam, type SearchParams } from "@/lib/projects/query";

import type { SummarisedSnapshot } from "./summary";

/**
 * Which snapshot a project's scope tab is comparing against.
 *
 * In the URL, like the tab and the projects list's filters, and for the same
 * reasons: a comparison is then a link — shareable with the person arguing
 * about it, bookmarkable, survives a reload, works with the back button — and
 * the page stays a server component with nothing to hydrate. A `<select>` and
 * some client state would have bought a smoother press and lost all of that.
 */

/** The name of the param carrying the snapshot, so links and the parser agree. */
export const SNAPSHOT_PARAM = "snapshot";

/**
 * The address of one project's scope tab comparing against one snapshot.
 *
 * Built on `projectTabHref` rather than by writing the path again, so an id
 * that needs escaping is escaped once and the tab's own canonical-address rule
 * is not restated here. The separator is worked out rather than assumed: the
 * scope tab is not the default today, so the href already carries a query, but
 * a day that changes the default must not silently produce `/projects/x&snapshot=`.
 */
export function snapshotComparisonHref(
  projectId: string,
  snapshotId: string,
): string {
  const base = projectTabHref(projectId, "scope");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${SNAPSHOT_PARAM}=${encodeURIComponent(snapshotId)}`;
}

/** Which snapshot a request is asking for, if it names one at all. */
export function readSnapshotParam(params: SearchParams): string | undefined {
  return firstParam(params[SNAPSHOT_PARAM]);
}

/**
 * The snapshot to compare against: the one asked for, else the most recent.
 *
 * Falling back rather than 404ing, the same call `parseProjectTab` makes: the
 * project exists and its scope list is worth showing, so a stale link naming a
 * snapshot somebody has since deleted should land on the newest comparison
 * rather than on an error page. Which snapshot is being compared is named on
 * the page, so nothing is hidden by landing somewhere other than asked.
 *
 * The most recent is the default because it is the question people actually
 * ask — "what has changed lately" — and because the list arrives newest first,
 * so it is the first row rather than a search.
 *
 * Null only when the project has never been snapshotted, which is the one case
 * where there is no comparison to show at all.
 */
export function chosenSnapshot(
  requested: string | undefined,
  snapshots: readonly SummarisedSnapshot[],
): SummarisedSnapshot | null {
  if (snapshots.length === 0) return null;
  const asked = snapshots.find((snapshot) => snapshot.id === requested);
  return asked ?? snapshots[0];
}
