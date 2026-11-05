import type { ProjectWithClient } from "@/lib/data/projects";
import { compareNames } from "@/lib/names";

import type { TimeLogQuery } from "./log-query";

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
 * What a client is called wherever the log names one.
 *
 * An archived client is marked, the same way the project form's picker marks
 * one. Without it the option is a puzzle — the reader knows the client book
 * does not list them, and here they are in a list of clients — and the answer
 * is that their projects are still on the books.
 */
function clientLabelOf(project: ProjectWithClient): string {
  return project.clientArchivedAt === null
    ? project.clientName
    : `${project.clientName} (archived)`;
}

/**
 * What a project is called, which depends on whether a client is already
 * filtered on.
 *
 * The client's name leads when every client is in play, because that is what
 * makes a list of projects scannable — a studio's projects are called
 * "Website" four times over. Once a client is filtered on, their name on every
 * line is a word that distinguishes nothing, so it comes off.
 *
 * One rule, because the picker and the heading above it have to agree: a
 * reader who chose "Harbour Co — Website" should see that phrase in the
 * heading rather than a shorter version of it.
 */
function projectLabelOf(
  project: ProjectWithClient,
  clientId: string | null,
): string {
  return clientId === null
    ? `${project.clientName} — ${project.name}`
    : project.name;
}

/**
 * Every client with a project, once each, in the order a person reads a list.
 *
 * Deduplicated on the id rather than on the name, because two clients can
 * share one: a studio with two contacts called James has two rows in the
 * client book, and collapsing them here would file one of them's time under
 * the other.
 */
export function clientFilterOptions(
  projects: readonly ProjectWithClient[],
): FilterOption[] {
  const byId = new Map<string, FilterOption>();
  for (const project of projects) {
    if (byId.has(project.clientId)) continue;
    byId.set(project.clientId, {
      value: project.clientId,
      label: clientLabelOf(project),
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
 * The labels are `projectLabelOf`'s, so the line a reader chose in the picker
 * is the phrase they then see in the heading.
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
      label: projectLabelOf(project, clientId),
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

/**
 * What the project and client filters actually name, resolved against every
 * project rather than against the narrowed picker.
 *
 * Three things can be true of an id in the URL, and the page has to tell them
 * apart because each needs different words:
 *
 * - it names something, and the heading can say what;
 * - it names nothing at all — a project deleted while the log sat open, or a
 *   hand-built URL — and the picker beside it will show its first option
 *   instead, so the page has to say in words what the control cannot;
 * - it names a real project belonging to a client the other filter excludes,
 *   which is the pair that can only ever show an empty log.
 *
 * Resolved against the whole list, which is what separates the second from the
 * third. The project picker is narrowed to the filtered client, so a project
 * of somebody else's is absent from it — and calling that "no longer on the
 * list" would be a sentence that is simply false about a project sitting on
 * the books.
 */
export type ResolvedLogFilters = {
  /** The project's name for the heading, or null when it named nothing. */
  readonly project: string | null;
  /** The client's name for the heading, or null when it named nothing. */
  readonly client: string | null;
  /** The project filter names no project at all. */
  readonly projectGone: boolean;
  /** The client filter names no client with a project. */
  readonly clientGone: boolean;
  /** Both name something real, and the project is not the client's. */
  readonly mismatched: boolean;
};

export function resolveLogFilters(
  query: Pick<TimeLogQuery, "projectId" | "clientId">,
  projects: readonly ProjectWithClient[],
): ResolvedLogFilters {
  const project =
    query.projectId === null
      ? null
      : (projects.find((one) => one.id === query.projectId) ?? null);
  /*
    Any project of theirs will do: the client's name and whether they are
    archived are the same on every row, and a client with no project has no
    time and so is not a client this log can be narrowed to.
  */
  const client =
    query.clientId === null
      ? null
      : (projects.find((one) => one.clientId === query.clientId) ?? null);

  return {
    project: project === null ? null : projectLabelOf(project, query.clientId),
    client: client === null ? null : clientLabelOf(client),
    projectGone: query.projectId !== null && project === null,
    clientGone: query.clientId !== null && client === null,
    mismatched:
      project !== null &&
      client !== null &&
      project.clientId !== query.clientId,
  };
}

/**
 * The sentence a log needs when one of its filters names something that is no
 * longer there, or null when both are fine.
 *
 * It says three things, because a reader seeing an unexpectedly short list
 * needs all three: that the filter is still in force, that the picker is not
 * showing it, and how to get back to everything.
 *
 * The two-filter case is its own sentence rather than the same one with a
 * plural slotted in. "Both name something ... narrowed to it" is a sentence
 * that disagrees with itself halfway through, and this note is read by someone
 * already unsure what the page is showing them.
 */
export function describeMissingFilters({
  projectGone,
  clientGone,
}: Pick<ResolvedLogFilters, "projectGone" | "clientGone">): string | null {
  if (!projectGone && !clientGone) return null;

  if (projectGone && clientGone) {
    return "The project and client filters both name something that is no longer on the lists below. The log is still narrowed to them, so the pickers show nothing chosen; clearing the filters shows everything again.";
  }

  const named = projectGone
    ? "The project filter names a project"
    : "The client filter names a client";

  return `${named} that is no longer on the list below. The log is still narrowed to it, so the picker shows nothing chosen; clearing the filters shows everything again.`;
}
