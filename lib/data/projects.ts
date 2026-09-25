import { desc, eq } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { clients, projects, type Project } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { lifecycleStamps } from "@/lib/projects/lifecycle";
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
  const [row] = await database
    .insert(projects)
    .values({
      id: newId("prj"),
      clientId: await requireClient(input.clientId, database),
      name: requiredText(input.name, "project name"),
      status,
      contractValueCents: wholeCents(
        input.contractValueCents ?? 0,
        "project contract value",
      ),
      rateCents: optionalCents(input.rateCents, "project rate override"),
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
