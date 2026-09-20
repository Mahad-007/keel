#!/usr/bin/env node
// Find the first unchecked roadmap task and emit it as workflow outputs.
// Picking the first *unchecked* box rather than today's date means a failed
// day is retried tomorrow instead of silently lost.

const fs = require("fs");

const ROADMAP = "ROADMAP.md";
const body = fs.readFileSync(ROADMAP, "utf8");
const lines = body.split("\n");

const idx = lines.findIndex((l) => /^- \[ \]/.test(l));

const out = [];
if (idx === -1) {
  console.log("Roadmap complete — every task is checked off.");
  out.push("found=false");
} else {
  const line = lines[idx];
  // "- [ ] **Day 07** — New project form with ..."
  const m = line.match(/^- \[ \]\s*\*\*(.+?)\*\*\s*[—-]\s*(.+)$/);
  if (!m) {
    console.error(`::error::could not parse roadmap line ${idx + 1}: ${line}`);
    process.exit(1);
  }
  const [, label, task] = m;
  console.log(`Next: ${label} — ${task.slice(0, 80)}...`);
  out.push("found=true");
  out.push(`label=${label}`);
  out.push(`line=${idx + 1}`);
  out.push(`task<<__TASK_EOF__\n${task}\n__TASK_EOF__`);
}

fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/stdout", out.join("\n") + "\n");
