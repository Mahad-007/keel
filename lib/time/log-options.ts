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
