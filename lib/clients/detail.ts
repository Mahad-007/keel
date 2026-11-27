/**
 * The addresses of one client, built in one place.
 *
 * `lib/projects/detail.ts`'s counterpart, and it exists for the reason that
 * one does: three pages link to a client's edit form — the projects list, the
 * portfolio, and the thresholds panel that names whose figures a project
 * inherited — and all three were spelling the path out. One of the three
 * escaped the id and two did not, which is exactly how that kind of
 * duplication goes wrong: it works on every id this app generates and fails on
 * the first one it does not.
 *
 * Only the two paths that are linked from elsewhere. `/clients` itself is
 * written out at a dozen call sites, most of them redirects and
 * revalidations in the clients pages' own actions, and sweeping those is not
 * this milestone's business.
 */

/** The client book. */
export const CLIENTS_PATH = "/clients";

/**
 * The address of one client.
 *
 * The id is encoded even though the ones this app generates never need it: the
 * function takes a string, and a path built by pasting an unescaped value into
 * it is the sort of thing that works until the day it does not. The same
 * reasoning, and the same line, as `projectPath`.
 */
export function clientPath(id: string): string {
  return `${CLIENTS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * The address of one client's edit form, which is where their rate and their
 * thresholds are set.
 *
 * A suffix on the client's own path rather than a second spelling of it, so an
 * id that needs escaping is escaped once, in one place.
 *
 * It is the client page in this app: there is no read-only client detail view,
 * so every link that means "look at this client" lands here. That is worth
 * knowing when reading the call sites, which all look like they are sending
 * somebody to a form.
 */
export function clientEditPath(id: string): string {
  return `${clientPath(id)}/edit`;
}
