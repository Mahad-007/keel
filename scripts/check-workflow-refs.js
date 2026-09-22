#!/usr/bin/env node
// Assert that every repo script a workflow invokes actually exists and is
// committed.
//
// This exists because of a real failure: a workflow step called
// `node scripts/check-migrations.js`, the file was never committed, node
// exited 1, and the step reported it as a blocked destructive migration. The
// run was discarded and the cause was invisible in the logs. A missing file
// should fail in a second, saying which file, not an hour later wearing
// another failure's name.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const WORKFLOWS = ".github/workflows";
// `node scripts/x.js`, `./scripts/x.sh`, `bash scripts/x.sh`
const REF = /(?:node|bash|sh|\.\/)\s*(scripts\/[A-Za-z0-9._\-/]+)/g;

let tracked = new Set();
try {
  tracked = new Set(
    execSync("git ls-files", { encoding: "utf8" }).split("\n").map((l) => l.trim()),
  );
} catch {
  console.error("::error::could not list tracked files");
  process.exit(1);
}

let bad = 0;
let checked = 0;

for (const file of fs.readdirSync(WORKFLOWS)) {
  if (!/\.ya?ml$/.test(file)) continue;
  const full = path.join(WORKFLOWS, file);
  const text = fs.readFileSync(full, "utf8");

  for (const [, ref] of text.matchAll(REF)) {
    checked++;
    if (!fs.existsSync(ref)) {
      console.error(`::error file=${full}::references ${ref}, which does not exist`);
      bad++;
    } else if (!tracked.has(ref)) {
      console.error(
        `::error file=${full}::references ${ref}, which exists locally but is NOT committed — CI will not see it`,
      );
      bad++;
    }
  }
}

console.log(`Checked ${checked} script reference(s) across workflows.`);
process.exit(bad ? 1 : 0);
