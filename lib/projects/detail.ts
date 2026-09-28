import { formatCents } from "@/lib/money";

import { firstParam, PROJECTS_PATH, type SearchParams } from "./query";
import {
  DEFAULT_PROJECT_TAB,
  parseProjectTab,
  type ProjectTab,
} from "./tabs";

/**
 * What the project detail page needs that is not a database read: where it
 * lives, how its tabs are addressed, and the sentences it puts on screen.
 *
 * The same reasoning as the list: the tab is in the URL rather than in
 * component state, so a tab is a link — shareable, bookmarkable, survives a
 * reload, works with the back button — and the page stays a server component
 * with nothing to hydrate.
 */

/** The name of the param carrying the tab, so links and the parser agree. */
export const TAB_PARAM = "tab";

/**
 * The address of one project.
 *
 * The id is encoded even though the ones this app generates never need it: the
 * function takes a string, and a path built by pasting an unescaped value into
 * it is the sort of thing that works until the day it does not.
 */
export function projectPath(id: string): string {
  return `${PROJECTS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * The address of one project's edit form. A suffix on the project's own path
 * rather than a second spelling of it, so an id that needs escaping is escaped
 * once, in one place.
 */
export function projectEditPath(id: string): string {
  return `${projectPath(id)}/edit`;
}

/**
 * The address of one tab of one project.
 *
 * The default tab is left out of the URL, so a project has exactly one
 * canonical address — `/projects/prj_x`, not that plus `?tab=overview`
 * rendering the same page. Two spellings of the same place is what turns a
 * shared link, a bookmark, and a back button into three different histories.
 */
export function projectTabHref(id: string, tab: ProjectTab): string {
  const path = projectPath(id);
  if (tab === DEFAULT_PROJECT_TAB) return path;
  return `${path}?${TAB_PARAM}=${encodeURIComponent(tab)}`;
}

/**
 * Which tab a request is asking for, out of the page's search params.
 *
 * Anything unrecognised lands on the default rather than 404ing: the project
 * exists, and refusing to show it because one query param is stale would throw
 * away the part of the URL that matters for the part that does not.
 */
export function parseProjectTabParam(params: SearchParams): ProjectTab {
  return parseProjectTab(firstParam(params[TAB_PARAM]));
}

/**
 * What a project's rate override means, in words.
 *
 * Three cases, and the difference between two of them is the whole reason the
 * column is nullable: NULL is "bill this at whatever the client bills at", and
 * zero is "bill this at nothing". Printing `$0.00/hr` for both would collapse a
 * deliberate decision into a missing one, and printing nothing for NULL leaves
 * the reader unsure whether the rate is inherited or lost.
 */
export function describeRateOverride(rateCents: number | null): string {
  if (rateCents === null) {
    return "No override — bills at the client's default rate.";
  }
  if (rateCents === 0) {
    return "Overridden to nothing — this project does not bill by the hour.";
  }
  return `${formatCents(rateCents)}/hr, overriding the client's default.`;
}
