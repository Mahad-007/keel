import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { clients, type Client } from "@/lib/db/schema";
import { newId } from "@/lib/id";

import { optionalText, requiredText, wholeCents } from "./fields";

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

export async function createClient(
  input: NewClientInput,
  database: Database = db,
): Promise<Client> {
  const now = new Date().toISOString();
  const [row] = await database
    .insert(clients)
    .values({
      id: newId("cli"),
      name: requiredText(input.name, "client name"),
      email: optionalText(input.email),
      company: optionalText(input.company),
      notes: optionalText(input.notes),
      defaultRateCents: wholeCents(input.defaultRateCents ?? 0, "client default rate"),
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

/**
 * The other half of the list: archived clients only, most recently archived
 * first. Somewhere has to show these, or a client archived by mistake is
 * unreachable from the UI even though the row is still there.
 */
export async function listArchivedClients(
  database: Database = db,
): Promise<Client[]> {
  return database
    .select()
    .from(clients)
    .where(isNotNull(clients.archivedAt))
    .orderBy(desc(clients.archivedAt), sql`lower(${clients.name})`);
}

/** Returns the updated row, or null if there is no client with that id. */
export async function updateClient(
  id: string,
  patch: ClientPatch,
  database: Database = db,
): Promise<Client | null> {
  const values: Partial<typeof clients.$inferInsert> = {};
  if (patch.name !== undefined) values.name = requiredText(patch.name, "client name");
  if (patch.email !== undefined) values.email = optionalText(patch.email);
  if (patch.company !== undefined) values.company = optionalText(patch.company);
  if (patch.notes !== undefined) values.notes = optionalText(patch.notes);
  if (patch.defaultRateCents !== undefined) {
    values.defaultRateCents = wholeCents(
      patch.defaultRateCents,
      "client default rate",
    );
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

/**
 * The inverse of `archiveClient`, and the reason archiving is safe: the row
 * never left the table, so restoring one is a cleared column rather than a
 * recreated client with a new id and a lost history.
 *
 * Restoring a client that is not archived changes nothing and returns the row
 * as it stands, so a double-submitted restore cannot bump `updatedAt` twice.
 */
export async function unarchiveClient(
  id: string,
  database: Database = db,
): Promise<Client | null> {
  const now = new Date().toISOString();
  const [row] = await database
    .update(clients)
    .set({ archivedAt: null, updatedAt: now })
    .where(and(eq(clients.id, id), isNotNull(clients.archivedAt)))
    .returning();
  return row ?? getClient(id, database);
}
