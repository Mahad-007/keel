import { createClient } from "@libsql/client";
const db = createClient({ url: "file:./keel.db" });
await db.execute("delete from time_entries");
await db.execute("delete from projects");
console.log("cleared");
