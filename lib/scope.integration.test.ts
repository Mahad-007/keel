import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  listDeliverables,
} from "@/lib/data/deliverables";
import { createProject, getProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { summariseScope } from "./scope";

/**
 * `scope.ts` is pure, and its own tests say what the arithmetic does. What
 * they cannot say is that `ScopeLine` still describes a real deliverable row,
 * or that a contract value read back out of the projects table lands in the
 * argument it belongs in.
 *
 * Those are the two joins the Day 016 panel will make, and both are structural
 * — the sort of thing that compiles for a year and then stops when a column is
 * renamed. So the summary is taken here over rows this test actually wrote,
 * through the same data layer the page will call.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    {
      clientId: client.id,
      name: "Engine rewrite",
      // $4,000 for the engagement.
      contractValueCents: 400_000,
    },
    db,
  );
  projectId = project.id;
});

async function summarise() {
  const [lines, project] = await Promise.all([
    listDeliverables(projectId, db),
    getProject(projectId, db),
  ]);
  return summariseScope(lines, project?.contractValueCents ?? 0);
}

describe("summariseScope over real deliverable rows", () => {
  it("summarises a project whose scope has not been written yet", async () => {
    const summary = await summarise();
    expect(summary.lineCount).toBe(0);
    expect(summary.estimatedMinutes).toBe(0);
    expect(summary.contractValueCents).toBe(400_000);
    expect(summary.impliedRateCents).toBeNull();
  });

  it("reads the estimate and the contract value out of two tables", async () => {
    await createDeliverable(
      { projectId, title: "Discovery", estimatedMinutes: 480 },
      db,
    );
    await createDeliverable(
      { projectId, title: "Build", estimatedMinutes: 1920 },
      db,
    );

    const summary = await summarise();
    expect(summary.lineCount).toBe(2);
    expect(summary.estimatedMinutes).toBe(2400);
    expect(summary.estimatedHours).toBe(40);
    // $4,000 over forty hours.
    expect(summary.impliedRateCents).toBe(10_000);
  });
});
