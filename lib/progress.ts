import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Progress = {
  done: number;
  total: number;
  /** The next unchecked milestone, or null once the roadmap is finished. */
  next: { label: string; summary: string } | null;
};

const TASK = /^- \[( |x)\]\s*\*\*(.+?)\*\*\s*[—-]\s*(.+)$/;

/** Parses roadmap markdown. Pure, so it can be tested without the file. */
export function parseProgress(markdown: string): Progress {
  let done = 0;
  let total = 0;
  let next: Progress["next"] = null;

  for (const line of markdown.split("\n")) {
    const m = line.match(TASK);
    if (!m) continue;
    const [, mark, label, summary] = m;
    total++;
    if (mark === "x") {
      done++;
    } else if (!next) {
      // First sentence is enough for a teaser; the roadmap has the detail.
      next = { label, summary: summary.split(/[.:]\s/)[0] };
    }
  }

  return { done, total, next };
}

/**
 * Read at build time, not per request — the page is statically rendered, so
 * this runs on the builder where ROADMAP.md is certainly present, and the
 * numbers are baked into the HTML.
 */
export function readProgress(): Progress {
  return parseProgress(readFileSync(join(process.cwd(), "ROADMAP.md"), "utf8"));
}
