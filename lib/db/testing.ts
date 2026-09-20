import { fileURLToPath } from "node:url";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema";
import type { Database } from "./index";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * A fresh in-memory database with the real migrations applied, for tests of
 * the data layer. Running the committed migrations rather than a hand-written
 * `CREATE TABLE` means a schema change that was never generated fails the
 * tests instead of passing them.
 */
export async function createTestDb(): Promise<Database> {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
