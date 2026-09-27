import { PROJECTS_PATH } from "./query";
import { DEFAULT_PROJECT_TAB, type ProjectTab } from "./tabs";

/**
 * Where a project's own page lives, and how the tab on it is addressed.
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
 * The address of one tab of one project.
 *
 * The default tab is left out of the URL, so a project has exactly one
 * canonical address — `/projects/prj_x`, not that plus `?tab=overview`
 * rendering the same page. The tab row marks the current tab by comparing
 * hrefs, and two spellings of the same place would leave nothing marked.
 */
export function projectTabHref(id: string, tab: ProjectTab): string {
  const path = projectPath(id);
  if (tab === DEFAULT_PROJECT_TAB) return path;
  return `${path}?${TAB_PARAM}=${encodeURIComponent(tab)}`;
}
