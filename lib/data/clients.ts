import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { clients, type Client } from "@/lib/db/schema";
import { newId } from "@/lib/id";

/**
 * Data access for the `clients` table. Plain async functions: pages and server
 * actions call these, and nothing outside this file touches Drizzle for a
 * client row.
 *
 * Every function takes an optional database handle so tests can run against a
 * throwaway in-memory database; production callers pass nothing.
 */

export type NewClientInput = {
  name: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  /** Default hourly rate in whole cents. Defaults to 0 — "not set yet". */
  defaultRateCents?: number;
};

/** Only the fields present are written, so a patch can touch one column. */
export type ClientPatch = Partial<NewClientInput>;

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`client ${field} is required`);
  return trimmed;
}

/** Blank optional fields are stored as NULL, never as an empty string. */
function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function rateCents(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error(`default rate must be whole cents, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`default rate cannot be negative, got ${value}`);
  }
  return value;
}

export async function createClient(
  input: NewClientInput,
  database: Database = db,
): Promise<Client> {
  const now = new Date().toISOString();
  const [row] = await database
    .insert(clients)
    .values({
      id: newId("cli"),
      name: requiredText(input.name, "name"),
      email: optionalText(input.email),
      company: optionalText(input.company),
      notes: optionalText(input.notes),
      defaultRateCents: rateCents(input.defaultRateCents ?? 0),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** Returns archived clients too: an old row still has to be viewable. */
export async function getClient(
  id: string,
  database: Database = db,
): Promise<Client | null> {
  const [row] = await database
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return row ?? null;
}

/** Active clients only, ordered the way a person reads a list: by name. */
export async function listClients(database: Database = db): Promise<Client[]> {
  return database
    .select()
    .from(clients)
    .where(isNull(clients.archivedAt))
    .orderBy(sql`lower(${clients.name})`, asc(clients.createdAt));
}

/** Returns the updated row, or null if there is no client with that id. */
export async function updateClient(
  id: string,
  patch: ClientPatch,
  database: Database = db,
): Promise<Client | null> {
  const values: Partial<typeof clients.$inferInsert> = {};
  if (patch.name !== undefined) values.name = requiredText(patch.name, "name");
  if (patch.email !== undefined) values.email = optionalText(patch.email);
  if (patch.company !== undefined) values.company = optionalText(patch.company);
  if (patch.notes !== undefined) values.notes = optionalText(patch.notes);
  if (patch.defaultRateCents !== undefined) {
    values.defaultRateCents = rateCents(patch.defaultRateCents);
  }

  if (Object.keys(values).length === 0) return getClient(id, database);

  values.updatedAt = new Date().toISOString();
  const [row] = await database
    .update(clients)
    .set(values)
    .where(eq(clients.id, id))
    .returning();
  return row ?? null;
}

/**
 * Soft delete: the row stays, `archivedAt` is stamped, and the client drops
 * out of `listClients`. Archiving twice keeps the original timestamp rather
 * than rewriting history.
 */
export async function archiveClient(
  id: string,
  database: Database = db,
): Promise<Client | null> {
  const now = new Date().toISOString();
  const [row] = await database
    .update(clients)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(clients.id, id), isNull(clients.archivedAt)))
    .returning();
  return row ?? getClient(id, database);
}
