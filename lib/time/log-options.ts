import type { ProjectWithClient } from "@/lib/data/projects";
import { compareNames } from "@/lib/names";

/**
 * The two pickers on the time log's filter form, built from the projects the
 * page already read.
 *
 * Built from the projects rather than from their own queries, which is what
 * makes the pickers agree with the log underneath them: a client with no
 * project has no time, so offering them would be offering a filter that can
 * only ever come back empty. It also means an archived client whose projects
 * are still on the books stays filterable — `listClients` leaves them out, and
 * their time did not stop existing when they went off the list.
 *
 * Pure, so what each option says and what order they come in can be tested
 * without a page.
 */

/** One line of a picker: what it submits, and what it reads as. */
export type FilterOption = {
  readonly value: string;
  readonly label: string;
};

/** The first line of each picker, standing for no filter on that field. */
export const EVERY_CLIENT_LABEL = "Every client";
export const EVERY_PROJECT_LABEL = "Every project";

/**
 * Every client with a project, once each, in the order a person reads a list.
 *
 * Deduplicated on the id rather than on the name, because two clients can
 * share one: a studio with two contacts called James has two rows in the
 * client book, and collapsing them here would file one of them's time under
 * the other.
 *
 * An archived client is marked, the same way the project form's picker marks
 * one. Without it the option is a puzzle — the reader knows the client book
 * does not list them, and here they are in a list of clients — and the answer
 * is that their projects are still on the books.
 */
export function clientFilterOptions(
  projects: readonly ProjectWithClient[],
): FilterOption[] {
  const byId = new Map<string, FilterOption>();
  for (const project of projects) {
    if (byId.has(project.clientId)) continue;
    byId.set(project.clientId, {
      value: project.clientId,
      label:
        project.clientArchivedAt === null
          ? project.clientName
          : `${project.clientName} (archived)`,
    });
  }
  return [...byId.values()].sort((left, right) =>
    compareNames(left.label, right.label),
  );
}

/**
 * The projects a log can be narrowed to, in the order the timesheet's rows
 * read: by client, then by project within the client.
 *
 * Narrowed to the client already filtered on, when there is one. A picker
 * offering forty projects of which thirty-eight cannot appear in the list is a
 * picker that answers a press with an empty log, and `withClient` drops a
 * project filter for the same reason.
 *
 * The client's name leads the label when every client is in play, because that
 * is what makes the list scannable — a studio's projects are called "Website"
 * four times over, and four identical lines in a collapsed `<select>` is a
 * choice nobody can make. Once a client is filtered on, their name on every
 * line is a word that distinguishes nothing, so it comes off.
 */
export function projectFilterOptions(
  projects: readonly ProjectWithClient[],
  clientId: string | null = null,
): FilterOption[] {
  const named = projects
    .filter((project) => clientId === null || project.clientId === clientId)
    .map((project) => ({
      client: project.clientName,
      value: project.id,
      label:
        clientId === null
          ? `${project.clientName} — ${project.name}`
          : project.name,
      name: project.name,
    }));

  return named
    .sort(
      (left, right) =>
        compareNames(left.client, right.client) ||
        compareNames(left.name, right.name) ||
        compareNames(left.value, right.value),
    )
    .map(({ value, label }) => ({ value, label }));
}
