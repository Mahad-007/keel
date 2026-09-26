import { asc, desc, eq, getTableColumns } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { clients, projects, type Project } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { lifecycleStamps } from "@/lib/projects/lifecycle";
import { DEFAULT_PROJECT_SORT, type ProjectSort } from "@/lib/projects/sort";
import {
  DEFAULT_PROJECT_STATUS,
  parseProjectStatus,
  type ProjectStatus,
} from "@/lib/projects/status";

import { optionalCents, requiredText, wholeCents } from "./fields";

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

  const [row] = await database
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
  return row;
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
 * belongs in the query, so the extra columns belong on the row type.
 *
 * `clientArchivedAt` rides along because archiving a client does not delete
 * their projects: the engagement still happened, and the list has to be able to
 * say the client is off the books rather than quietly showing a live-looking
 * name.
 */
export type ProjectListRow = Project & {
  clientName: string;
  clientArchivedAt: string | null;
};

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
): Promise<ProjectListRow[]> {
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
