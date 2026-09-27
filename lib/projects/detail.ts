import { PROJECTS_PATH } from "./query";

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
