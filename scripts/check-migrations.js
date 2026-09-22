#!/usr/bin/env node
// Refuse to apply a migration that destroys data unless it says so on purpose.
//
//   check-migrations.js <base-sha>
//
// An agent generating migrations unattended for ~100 days will eventually
// write a DROP. Turso's free tier has no point-in-time recovery, so the cost
// of that landing silently is the whole database. A migration that genuinely
// needs to drop something must carry the marker below, which is a deliberate
// act rather than a diff nobody read.
//
//   -- keel:allow-destructive <reason>

const { execSync } = require("node:child_process");
const fs = require("node:fs");

const base = process.argv[2];
if (!base) {
  console.error("::error::usage: check-migrations.js <base-sha>");
  process.exit(1);
}

/**
 * SQLite cannot alter most column constraints in place, so Drizzle emulates it
 * by building `__new_<table>`, copying every row across, dropping the original
 * and renaming. That DROP is part of a copy, not a deletion — treating it as
 * destructive would flag almost every ordinary schema change and make the
 * guard useless. Recognise the whole shape before judging the DROP.
 */
function recreatedTables(sql) {
  const created = new Set();
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+[`"']?__new_([A-Za-z0-9_]+)[`"']?/gi)) {
    created.add(m[1]);
  }
  const renamed = new Set();
  for (const m of sql.matchAll(
    /ALTER\s+TABLE\s+[`"']?__new_([A-Za-z0-9_]+)[`"']?\s+RENAME\s+TO\s+[`"']?([A-Za-z0-9_]+)[`"']?/gi,
  )) {
    if (m[1] === m[2]) renamed.add(m[2]);
  }
  // Only a table that is both built as __new_ and renamed back counts.
  return new Set([...created].filter((t) => renamed.has(t)));
}

function findings(sql) {
  const safeDrops = recreatedTables(sql);
  const out = [];

  for (const m of sql.matchAll(/\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([A-Za-z0-9_]+)[`"']?/gi)) {
    const table = m[1];
    if (safeDrops.has(table)) continue; // part of a copy-and-rename
    out.push(`DROP TABLE ${table}`);
  }
  for (const m of sql.matchAll(/\bDROP\s+COLUMN\s+[`"']?([A-Za-z0-9_]+)[`"']?/gi)) {
    out.push(`DROP COLUMN ${m[1]}`);
  }
  if (/\bTRUNCATE\b/i.test(sql)) out.push("TRUNCATE");
  if (/\bDROP\s+DATABASE\b/i.test(sql)) out.push("DROP DATABASE");
  if (/\bDELETE\s+FROM\b/i.test(sql)) out.push("DELETE FROM");

  return out;
}

let changed = [];
try {
  changed = execSync(`git diff --name-only --diff-filter=AM ${base}..HEAD -- drizzle`, {
    encoding: "utf8",
  })
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.endsWith(".sql"));
} catch (err) {
  console.error(`::error::could not diff migrations: ${err.message}`);
  process.exit(1);
}

if (changed.length === 0) {
  console.log("No new migrations in this run.");
  process.exit(0);
}

let blocked = false;
for (const file of changed) {
  const sql = fs.readFileSync(file, "utf8");
  const allowed = /--\s*keel:allow-destructive/i.test(sql);
  const hits = findings(sql);

  if (hits.length && !allowed) {
    console.error(
      `::error file=${file}::destructive DDL without a keel:allow-destructive marker: ${hits.join(", ")}`,
    );
    blocked = true;
  } else if (hits.length) {
    console.log(`${file}: destructive (${hits.join(", ")}), explicitly allowed`);
  } else {
    console.log(`${file}: safe`);
  }
}

process.exit(blocked ? 1 : 0);
