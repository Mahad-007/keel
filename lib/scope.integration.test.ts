import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  listDeliverables,
  setDeliverableStatus,
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

describe("a summary following the work", () => {
  beforeEach(async () => {
    for (const [title, estimatedMinutes] of [
      ["Discovery", 480],
      ["Build", 1_440],
      ["Handover", 480],
    ] as const) {
      await createDeliverable({ projectId, title, estimatedMinutes }, db);
    }
  });

  it("starts with everything still to do", async () => {
    const summary = await summarise();
    expect(summary.remainingMinutes).toBe(2400);
    expect(summary.deliveredMinutes).toBe(0);
    expect(summary.deliveredShare).toBe(0);
  });

  it("does not move when a deliverable is started", async () => {
    const [first] = await listDeliverables(projectId, db);
    await setDeliverableStatus(first.id, first.status, "started", db);

    const summary = await summarise();
    expect(summary.remainingMinutes).toBe(2400);
    expect(summary.deliveredShare).toBe(0);
  });

  it("moves the finished line across when it is marked done", async () => {
    const [first] = await listDeliverables(projectId, db);
    await setDeliverableStatus(first.id, first.status, "done", db);

    const summary = await summarise();
    expect(summary.deliveredMinutes).toBe(480);
    expect(summary.remainingMinutes).toBe(1920);
    expect(summary.deliveredShare).toBe(480 / 2400);
    // The rate the contract implies does not change as work completes.
    expect(summary.impliedRateCents).toBe(10_000);
  });

  it("reaches a whole share once every line is done", async () => {
    for (const row of await listDeliverables(projectId, db)) {
      await setDeliverableStatus(row.id, row.status, "done", db);
    }

    const summary = await summarise();
    expect(summary.deliveredShare).toBe(1);
    expect(summary.remainingMinutes).toBe(0);
  });
});
