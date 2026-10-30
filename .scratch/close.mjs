import { createClient } from "@libsql/client";
const db = createClient({ url: "file:./keel.db" });
await db.execute("update projects set status='paused'");
console.log("paused all");
