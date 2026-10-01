import { asc, count, desc, eq, getTableColumns } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { clients, projects, type Project } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { lifecycleStamps } from "@/lib/projects/lifecycle";
import { DEFAULT_PROJECT_SORT, type ProjectSort } from "@/lib/projects/sort";
import {
  DEFAULT_PROJECT_STATUS,
  isProjectStatus,
  parseProjectStatus,
  type ProjectStatus,
} from "@/lib/projects/status";
import {
  checkTransition,
  type TransitionProblem,
} from "@/lib/projects/transitions";

import {
  optionalCents,
  optionalText,
  requiredText,
  wholeCents,
} from "./fields";
import { recordProjectStatusEvent } from "./project-status-events";

/**
 * Data access for the `projects` table. Plain async functions, one optional
 * database handle each, and nothing outside this file touches Drizzle for a
 * project row — the same shape as `clients.ts`.
 */

export type NewProjectInput = {
  /** The client the engagement belongs to. Must already exist. */
  clientId: string;
  name: string;
  /** Defaults to `draft`: a project exists before it is agreed to. */
  status?: ProjectStatus;
  /** The whole agreed value of the engagement, in whole cents. */
  contractValueCents?: number;
  /**
   * Hourly rate override in whole cents. `null` — the default — means "bill at
   * the client's rate", which is a different statement from a zero override.
   */
  rateCents?: number | null;
};

/**
 * Only the fields present are written, so a patch can touch one column. There
 * is deliberately no `startedAt` or `closedAt` here: both are derived from the
 * status the project moves to, not set by hand.
 */
export type ProjectPatch = Partial<NewProjectInput>;

/**
 * A project without a client is not a project, and the foreign key would stop
 * one anyway — but it would stop it with a constraint error naming a column.
 * Checking here means the caller gets a message naming the id it passed, which
 * is the one thing that tells them what went wrong.
 */
async function requireClient(id: string, database: Database): Promise<string> {
  const clientId = requiredText(id, "project client");
  const [row] = await database
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!row) throw new Error(`no client with id ${clientId}`);
  return row.id;
}

export async function createProject(
  input: NewProjectInput,
  database: Database = db,
): Promise<Project> {
  const now = new Date().toISOString();
  const status = parseProjectStatus(input.status ?? DEFAULT_PROJECT_STATUS);
  /**
   * A project created straight into `active` did begin, and one created as
   * `closed` — an engagement recorded after the fact — did end. Deriving both
   * from the same rule the updates use keeps a back-filled row indistinguishable
   * from one that walked through the statuses.
   */
  const stamps = lifecycleStamps(
    { status: DEFAULT_PROJECT_STATUS, startedAt: null, closedAt: null },
    status,
    now,
  );
  /**
   * Everything that can be checked without a query is checked first, so the
   * common mistake — a blank name, a fractional amount — costs no round trip
   * and the client lookup only happens for a project that is otherwise valid.
   */
  const name = requiredText(input.name, "project name");
  const contractValueCents = wholeCents(
    input.contractValueCents ?? 0,
    "project contract value",
  );
  const rateCents = optionalCents(input.rateCents, "project rate override");
  const clientId = await requireClient(input.clientId, database);

  /**
   * The project and the first line of its status trail are one write. A
   * project whose trail starts at its second move would read as having
   * appeared already active, which is exactly the kind of gap an audit trail
   * exists to not have.
   */
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({
        id: newId("prj"),
        clientId,
        name,
        status,
        contractValueCents,
        rateCents,
        ...stamps,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await recordProjectStatusEvent(
      { projectId: row.id, fromStatus: null, toStatus: status },
      tx,
    );
    return row;
  });
}

/** One project by id, or null if there is no project with that id. */
export async function getProject(
  id: string,
  database: Database = db,
): Promise<Project | null> {
  const [row] = await database
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * The order every project list uses: newest first, with the id breaking ties
 * so that two projects created in the same millisecond do not come back in an
 * arbitrary order. One constant, so the lists cannot drift apart.
 */
const NEWEST_FIRST = [desc(projects.createdAt), desc(projects.id)] as const;

/**
 * Every project, newest first — unlike clients, which read alphabetically. A
 * project list is a list of current work, and the thing just set up is the
 * thing being looked for.
 */
export async function listProjects(database: Database = db): Promise<Project[]> {
  return database
    .select()
    .from(projects)
    .orderBy(...NEWEST_FIRST);
}

/**
 * One client's projects, newest first. Its own function rather than a filter
 * the caller applies, so the query uses the `projects_client_id_idx` index and
 * a client page does not read every project in the database to show three.
 */
export async function listProjectsForClient(
  clientId: string,
  database: Database = db,
): Promise<Project[]> {
  return database
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(...NEWEST_FIRST);
}

/**
 * Applies the fields present in the patch and returns the updated row, or null
 * if there is no project with that id. An empty patch is a no-op rather than a
 * write, so a form that was submitted without a change does not bump
 * `updatedAt` and reorder somebody's list.
 *
 * A status in the patch also rewrites `startedAt` and `closedAt`, through the
 * same rule `createProject` uses: the two dates are derived from the status a
 * project moves to, never set by a caller.
 */
export async function updateProject(
  id: string,
  patch: ProjectPatch,
  database: Database = db,
): Promise<Project | null> {
  const now = new Date().toISOString();
  const values: Partial<typeof projects.$inferInsert> = {};
  if (patch.name !== undefined) {
    values.name = requiredText(patch.name, "project name");
  }
  if (patch.contractValueCents !== undefined) {
    values.contractValueCents = wholeCents(
      patch.contractValueCents,
      "project contract value",
    );
  }
  if (patch.rateCents !== undefined) {
    values.rateCents = optionalCents(patch.rateCents, "project rate override");
  }

  /**
   * Reassigning a project is rare but real — work set up under the wrong client,
   * or a client that turned out to be two. It goes through the same existence
   * check as creating one, so a patch cannot orphan a row that was fine.
   */
  if (patch.clientId !== undefined) {
    values.clientId = await requireClient(patch.clientId, database);
  }

  if (patch.status !== undefined) {
    const status = parseProjectStatus(patch.status);
    const current = await getProject(id, database);
    if (!current) return null;
    values.status = status;
    Object.assign(values, lifecycleStamps(current, status, now));
  }

  if (Object.keys(values).length === 0) return getProject(id, database);

  values.updatedAt = now;
  const [row] = await database
    .update(projects)
    .set(values)
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

/**
 * Removes the row and returns it, or null if there was no project with that id.
 *
 * A project is deleted outright rather than archived the way a client is: the
 * way to retire an engagement that happened is to close it, which keeps its
 * time and its history, so the only reason left to delete one is that it should
 * never have existed. Nothing is gained by keeping that row, and a mistyped
 * project lingering in every list is the cost of pretending otherwise.
 */
export async function deleteProject(
  id: string,
  database: Database = db,
): Promise<Project | null> {
  const [row] = await database
    .delete(projects)
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

/**
 * A project row with the client it belongs to spelled out.
 *
 * A list of projects that shows a `clientId` is unreadable, and a page that
 * fetches the client for each row to fix that is a query per project. The join
 * belongs in the query, so the extra columns belong on the row type. The
 * detail page needs exactly the same three facts as the list, so it is one
 * type rather than two that would drift.
 *
 * `clientArchivedAt` rides along because archiving a client does not delete
 * their projects: the engagement still happened, and the list has to be able to
 * say the client is off the books rather than quietly showing a live-looking
 * name.
 */
export type ProjectWithClient = Project & {
  clientName: string;
  clientArchivedAt: string | null;
};

/**
 * One project with its client's name, or null if there is no project with that
 * id — what the project page reads.
 *
 * Its own query rather than `getProject` followed by `getClient`: the page
 * cannot render a header without both, so two sequential round trips would be
 * two waits for one screen, and a project whose client vanished between them
 * would be a state the page has no way to show.
 *
 * The join is inner for the same reason the list's is: the foreign key
 * guarantees the client row exists, so a left join would add a null case that
 * cannot happen and that the page would then have to render something for.
 */
export async function getProjectWithClient(
  id: string,
  database: Database = db,
): Promise<ProjectWithClient | null> {
  const [row] = await database
    .select({
      ...getTableColumns(projects),
      clientName: clients.name,
      clientArchivedAt: clients.archivedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * What a list page asks for: the status to restrict to, if any, and the order
 * to return. Both optional, and the defaults are the ones the plain
 * `listProjects` already uses — every project, newest first.
 */
export type ProjectListQuery = {
  status?: ProjectStatus;
  sort?: ProjectSort;
};

/** The project column each sort column in the URL actually orders by. */
const SORT_COLUMNS = {
  created: projects.createdAt,
  updated: projects.updatedAt,
} as const;

/**
 * The list the projects page renders: every project, or one status of them,
 * with the client name joined in and ordered by the column asked for.
 *
 * The id is always the tiebreaker, in the same direction as the sort. Two
 * projects created in the same second would otherwise come back in whatever
 * order SQLite felt like, which reads as rows shuffling between reloads.
 *
 * The join is inner rather than left: the foreign key and `requireClient` both
 * guarantee a client exists, so a left join would only add a null case that
 * cannot happen and that every caller would then have to handle.
 */
export async function listProjectsWithClient(
  query: ProjectListQuery = {},
  database: Database = db,
): Promise<ProjectWithClient[]> {
  const { column, direction } = query.sort ?? DEFAULT_PROJECT_SORT;
  const order = direction === "asc" ? asc : desc;

  return database
    .select({
      ...getTableColumns(projects),
      clientName: clients.name,
      clientArchivedAt: clients.archivedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(
      query.status === undefined ? undefined : eq(projects.status, query.status),
    )
    .orderBy(order(SORT_COLUMNS[column]), order(projects.id));
}

/** How many projects sit in each status. Every status is present, even at zero. */
export type ProjectStatusCounts = Record<ProjectStatus, number>;

/** A count of zero for every status, before the query fills any of them in. */
function noProjects(): ProjectStatusCounts {
  return { draft: 0, active: 0, paused: 0, closed: 0 };
}

/**
 * How many projects are in each status, in one grouped query.
 *
 * The filter tabs need this: a tab that says how many projects it would show
 * saves a click into an empty list, and a filter row with no numbers on it
 * makes the reader guess where the work is. Counting in SQL rather than by
 * reading every row keeps that cheap as the table grows.
 *
 * Statuses with nothing in them do not come back from a `GROUP BY`, so the
 * result starts at zero everywhere and the query fills in what it finds.
 *
 * SQLite does not enforce the status enum — the column is plain TEXT and the
 * four values are a type-level promise — so a hand-edited row can hold anything.
 * Such a row is left out of the tab counts rather than throwing: it still
 * appears in the unfiltered table, and a slightly low count is a far better
 * failure than a 500 that hides every project on the page.
 */
export async function countProjectsByStatus(
  database: Database = db,
): Promise<ProjectStatusCounts> {
  const rows = await database
    .select({ status: projects.status, total: count() })
    .from(projects)
    .groupBy(projects.status);

  const counts = noProjects();
  for (const row of rows) {
    if (!isProjectStatus(row.status)) continue;
    counts[row.status] = Number(row.total);
  }
  return counts;
}

/**
 * Why a status move was not made. The transition guard's own reasons, plus the
 * one it cannot have an opinion about: there was no project to move.
 *
 * A code rather than a thrown error because none of these is a bug. Every one
 * of them is reachable from a page that was correct when it rendered and is
 * not any more, and the caller has to be able to say which happened.
 */
export type ProjectTransitionProblem =
  | TransitionProblem
  | { readonly code: "no-such-project"; readonly message: string };

/** The outcome of asking a project to change status. */
export type ProjectTransitionResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly problem: ProjectTransitionProblem };

/** Said once, so the data layer and the action cannot drift apart on it. */
const NO_SUCH_PROJECT: ProjectTransitionProblem = {
  code: "no-such-project",
  message: "That project no longer exists. Nothing was changed.",
};

/** What a status move may carry besides the status itself. */
export type ProjectTransitionOptions = {
  /** Why the move was made. Required to reopen a closed project. */
  reason?: string | null;
};

/**
 * Moves a project to another status, if the lifecycle allows it.
 *
 * This is the only way a project's status changes. `updateProject` deliberately
 * cannot touch the column: a patch is a form saving four fields, and a status
 * change is a decision with a guard in front of it and a row of history behind
 * it. One door means a closed project cannot quietly reopen through the other.
 *
 * The guard runs against the row as it is read inside the transaction rather
 * than against whatever the page was showing, so two people pressing Close on
 * the same project do not both succeed: the second reads a closed project and
 * is refused.
 *
 * The status, the two lifecycle dates, and the trail entry are one write.
 * A status that moved without leaving a line behind is the failure the trail
 * exists to rule out, so it must not be possible to get one by losing a
 * connection between two statements.
 */
export async function transitionProject(
  id: string,
  to: ProjectStatus,
  options: ProjectTransitionOptions = {},
  database: Database = db,
): Promise<ProjectTransitionResult> {
  const next = parseProjectStatus(to);
  const reason = optionalText(options.reason);
  const now = new Date().toISOString();

  return database.transaction(async (tx) => {
    const current = await getProject(id, tx);
    if (current === null) return { ok: false, problem: NO_SUCH_PROJECT };

    const problem = checkTransition(current.status, next, reason);
    if (problem !== null) return { ok: false, problem };

    const [row] = await tx
      .update(projects)
      .set({
        status: next,
        ...lifecycleStamps(current, next, now),
        updatedAt: now,
      })
      .where(eq(projects.id, id))
      .returning();

    await recordProjectStatusEvent(
      {
        projectId: id,
        fromStatus: current.status,
        toStatus: next,
        reason,
      },
      tx,
    );

    return { ok: true, project: row };
  });
}
