import { createClient } from "@libsql/client";
const db = createClient({ url: "file:./keel.db" });
const now = new Date().toISOString();
await db.execute({ sql: "insert into clients (id,name,default_rate_cents,created_at,updated_at) values (?,?,?,?,?)", args: ["cli_1","Harbour Co",9500,now,now] });
await db.execute({ sql: "insert into clients (id,name,default_rate_cents,created_at,updated_at) values (?,?,?,?,?)", args: ["cli_2","anvil studio",8000,now,now] });
await db.execute({ sql: "insert into projects (id,client_id,name,status,contract_value_cents,created_at,updated_at) values (?,?,?,?,?,?,?)", args: ["prj_1","cli_1","Site rebuild","active",1200000,now,now] });
await db.execute({ sql: "insert into projects (id,client_id,name,status,contract_value_cents,created_at,updated_at) values (?,?,?,?,?,?,?)", args: ["prj_2","cli_2","Brand refresh","active",450000,now,now] });
await db.execute({ sql: "insert into projects (id,client_id,name,status,contract_value_cents,created_at,updated_at) values (?,?,?,?,?,?,?)", args: ["prj_3","cli_1","Old microsite","closed",200000,now,now] });
const entries = [
  ["tme_1","prj_1",150,"2026-10-26",1],
  ["tme_2","prj_1",90,"2026-10-26",1],
  ["tme_3","prj_1",45,"2026-10-28",0],
  ["tme_4","prj_2",300,"2026-10-27",1],
  ["tme_5","prj_2",60,"2026-10-31",1],
  ["tme_6","prj_3",120,"2026-10-29",1],
];
for (const [id,pid,minutes,day,billable] of entries) {
  await db.execute({ sql: "insert into time_entries (id,project_id,minutes,worked_on,billable,created_at,updated_at) values (?,?,?,?,?,?,?)", args: [id,pid,minutes,day,billable,now,now] });
}
console.log("seeded");
