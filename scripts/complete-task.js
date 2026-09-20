#!/usr/bin/env node
// Tick the checkbox on a given 1-indexed roadmap line.
//   complete-task.js <line-number>

const fs = require("fs");

const ROADMAP = "ROADMAP.md";
const lineNo = Number(process.argv[2]);

if (!Number.isInteger(lineNo) || lineNo < 1) {
  console.error(`::error::expected a line number, got: ${process.argv[2]}`);
  process.exit(1);
}

const lines = fs.readFileSync(ROADMAP, "utf8").split("\n");
const target = lines[lineNo - 1];

if (target === undefined || !/^- \[ \]/.test(target)) {
  console.error(`::error::line ${lineNo} is not an unchecked task: ${target}`);
  process.exit(1);
}

lines[lineNo - 1] = target.replace("- [ ]", "- [x]");
fs.writeFileSync(ROADMAP, lines.join("\n"));
console.log(`Checked off line ${lineNo}.`);
