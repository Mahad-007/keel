import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * libSQL rather than plain SQLite: the same file-backed database locally
 * (`file:./keel.db`), but it can point at a hosted Turso URL in production
 * without a driver swap.
 */
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./keel.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { schema };

/**
 * What the data layer accepts. Functions in `lib/data/` default to the shared
 * `db` but take any handle of this type, so tests can hand them a throwaway
 * in-memory database instead.
 */
export type Database = LibSQLDatabase<typeof schema>;
