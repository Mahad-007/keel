import { createClient, type ResultSet } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

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
 *
 * The base type rather than `LibSQLDatabase` itself, because a transaction
 * handle is not one: Drizzle hands the callback of `db.transaction` a
 * `SQLiteTransaction`, which has every query method and no `batch`. Typing the
 * handle as the common base is what lets a function that writes two tables pass
 * the transaction down to the module that owns each one, instead of reaching
 * into a table it does not own to keep the two writes atomic.
 */
export type Database = BaseSQLiteDatabase<"async", ResultSet, typeof schema>;
