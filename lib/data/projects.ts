import { db, type Database } from "@/lib/db";
import { projects, type Project } from "@/lib/db/schema";
import { newId } from "@/lib/id";
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

export async function createProject(
  input: NewProjectInput,
  database: Database = db,
): Promise<Project> {
  const now = new Date().toISOString();
  const [row] = await database
    .insert(projects)
    .values({
      id: newId("prj"),
      clientId: requiredText(input.clientId, "project client"),
      name: requiredText(input.name, "project name"),
      status: parseProjectStatus(input.status ?? DEFAULT_PROJECT_STATUS),
      contractValueCents: wholeCents(
        input.contractValueCents ?? 0,
        "project contract value",
      ),
      rateCents: optionalCents(input.rateCents, "project rate override"),
      startedAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}
