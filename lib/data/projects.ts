import { eq } from "drizzle-orm";

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
