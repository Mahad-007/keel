import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { deliverables, projects, scopeSnapshots } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";
import type { SnapshotLineDraft } from "@/lib/snapshots/capture";

import { createClient } from "./clients";
import { createDeliverable, updateDeliverable } from "./deliverables";
import { createProject } from "./projects";
import {
  captureScopeSnapshot,
  createScopeSnapshot,
  latestScopeSnapshot,
  listScopeSnapshots,
  listSnapshotLines,
} from "./scope-snapshots";

let db: Database;
/** Every snapshot hangs off a project, which hangs off a client. */
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Harbour Co" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Site rebuild", contractValueCents: 500_000 },
    db,
  );
  projectId = project.id;
});

/**
 * `capturedAt` comes from the wall clock, so two snapshots written in the same
 * millisecond would tie and an ordering test would pass or fail by luck.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

const LINES: SnapshotLineDraft[] = [
  {
    deliverableId: "dlv_one",
    title: "Discovery",
    description: "Two workshops.",
    estimatedMinutes: 480,
    status: "done",
  },
  {
    deliverableId: "dlv_two",
    title: "Build",
    description: null,
    estimatedMinutes: 2_400,
    status: "pending",
  },
];

describe("createScopeSnapshot", () => {
  it("stores the snapshot and hands back the saved row", async () => {
    const snapshot = await createScopeSnapshot(
      {
        projectId,
        label: "Signed proposal",
        contractValueCents: 500_000,
        lines: LINES,
      },
      db,
    );

    expect(snapshot.id).toMatch(/^snp_/);
    expect(snapshot.projectId).toBe(projectId);
    expect(snapshot.label).toBe("Signed proposal");
    expect(snapshot.contractValueCents).toBe(500_000);
    expect(snapshot.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("writes the lines in the order given, dense from zero", async () => {
    const snapshot = await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );

    const lines = await listSnapshotLines(snapshot.id, db);
    expect(lines.map((line) => line.title)).toEqual(["Discovery", "Build"]);
    expect(lines.map((line) => line.sortOrder)).toEqual([0, 1]);
    expect(lines[0].id).toMatch(/^sln_/);
  });

  it("records which deliverable each line was copied from", async () => {
    const snapshot = await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );

    const lines = await listSnapshotLines(snapshot.id, db);
    expect(lines.map((line) => line.deliverableId)).toEqual([
      "dlv_one",
      "dlv_two",
    ]);
  });

  it("records the status each line was in", async () => {
    const snapshot = await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );

    const lines = await listSnapshotLines(snapshot.id, db);
    expect(lines.map((line) => line.status)).toEqual(["done", "pending"]);
  });

  it("stores an absent label as NULL", async () => {
    const snapshot = await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );

    expect(snapshot.label).toBeNull();
  });

  it("stores a blank label as NULL rather than as whitespace", async () => {
    const snapshot = await createScopeSnapshot(
      { projectId, label: "   ", contractValueCents: 0, lines: LINES },
      db,
    );

    expect(snapshot.label).toBeNull();
  });

  it("refuses a snapshot with no lines on it", async () => {
    await expect(
      createScopeSnapshot({ projectId, contractValueCents: 0, lines: [] }, db),
    ).rejects.toThrow(/at least one deliverable/);
  });

  it("writes no snapshot row when the lines cannot be written", async () => {
    await expect(
      createScopeSnapshot(
        {
          projectId,
          contractValueCents: 0,
          lines: [{ ...LINES[0], estimatedMinutes: 90.5 }],
        },
        db,
      ),
    ).rejects.toThrow(/whole minutes/);

    // A snapshot whose lines failed to write would compare as though the
    // whole project had been added since.
    expect(await db.select().from(scopeSnapshots)).toEqual([]);
  });

  it("refuses a contract value that is not whole cents", async () => {
    await expect(
      createScopeSnapshot(
        { projectId, contractValueCents: 1.5, lines: LINES },
        db,
      ),
    ).rejects.toThrow(/whole cents/);
  });
});

describe("createScopeSnapshot recording a hand-edited row", () => {
  it("records a title exactly as it read, untrimmed", async () => {
    const snapshot = await createScopeSnapshot(
      {
        projectId,
        contractValueCents: 0,
        lines: [{ ...LINES[0], title: "  Discovery  " }],
      },
      db,
    );

    // Trimming would make the comparison report a change the reader cannot
    // see on the page.
    const [line] = await listSnapshotLines(snapshot.id, db);
    expect(line.title).toBe("  Discovery  ");
  });

  it("records an estimate below zero rather than refusing the snapshot", async () => {
    const snapshot = await createScopeSnapshot(
      {
        projectId,
        contractValueCents: 0,
        lines: [{ ...LINES[0], estimatedMinutes: -120 }],
      },
      db,
    );

    const [line] = await listSnapshotLines(snapshot.id, db);
    expect(line.estimatedMinutes).toBe(-120);
  });
});

describe("listSnapshotLines", () => {
  it("reads only the lines of the snapshot asked for", async () => {
    const first = await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );
    const second = await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: [LINES[0]] },
      db,
    );

    expect(await listSnapshotLines(first.id, db)).toHaveLength(2);
    expect(await listSnapshotLines(second.id, db)).toHaveLength(1);
  });

  it("answers nothing for a snapshot that does not exist", async () => {
    expect(await listSnapshotLines("snp_nope", db)).toEqual([]);
  });
});

describe("listScopeSnapshots", () => {
  it("summarises each snapshot's scope list in one query", async () => {
    const written = await createScopeSnapshot(
      {
        projectId,
        label: "Signed proposal",
        contractValueCents: 500_000,
        lines: LINES,
      },
      db,
    );

    expect(await listScopeSnapshots(projectId, db)).toEqual([
      {
        id: written.id,
        label: "Signed proposal",
        capturedAt: written.capturedAt,
        contractValueCents: 500_000,
        lineCount: 2,
        estimatedMinutes: 2_880,
        unestimatedCount: 0,
        negativeEstimateCount: 0,
      },
    ]);
  });

  it("counts the lines nobody had sized when it was taken", async () => {
    await createScopeSnapshot(
      {
        projectId,
        contractValueCents: 0,
        lines: [LINES[0], { ...LINES[1], estimatedMinutes: 0 }],
      },
      db,
    );

    const [snapshot] = await listScopeSnapshots(projectId, db);
    expect(snapshot).toMatchObject({
      lineCount: 2,
      estimatedMinutes: 480,
      unestimatedCount: 1,
    });
  });

  it("reads newest first, which is what a comparison defaults to", async () => {
    const first = await createScopeSnapshot(
      { projectId, label: "At signing", contractValueCents: 0, lines: LINES },
      db,
    );
    await tick();
    const second = await createScopeSnapshot(
      {
        projectId,
        label: "After the change order",
        contractValueCents: 0,
        lines: LINES,
      },
      db,
    );

    expect(
      (await listScopeSnapshots(projectId, db)).map((row) => row.id),
    ).toEqual([second.id, first.id]);
  });

  it("reads only the snapshots of the project asked for", async () => {
    const client = await createClient({ name: "Other Co" }, db);
    const other = await createProject(
      { clientId: client.id, name: "Something else" },
      db,
    );
    await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );
    await createScopeSnapshot(
      { projectId: other.id, contractValueCents: 0, lines: LINES },
      db,
    );

    expect(await listScopeSnapshots(projectId, db)).toHaveLength(1);
    expect(await listScopeSnapshots(other.id, db)).toHaveLength(1);
  });

  it("answers nothing for a project nobody has snapshotted", async () => {
    expect(await listScopeSnapshots(projectId, db)).toEqual([]);
  });

  it("totals a recorded negative estimate rather than ignoring it", async () => {
    await createScopeSnapshot(
      {
        projectId,
        contractValueCents: 0,
        lines: [LINES[0], { ...LINES[1], estimatedMinutes: -60 }],
      },
      db,
    );

    const [snapshot] = await listScopeSnapshots(projectId, db);
    expect(snapshot.estimatedMinutes).toBe(420);
  });

  it("counts the negative lines the total cannot be asked about", async () => {
    await createScopeSnapshot(
      {
        projectId,
        contractValueCents: 0,
        lines: [
          { ...LINES[0], estimatedMinutes: 120 },
          { ...LINES[1], estimatedMinutes: -120 },
        ],
      },
      db,
    );

    // The pair cancel out, so the total alone says the snapshot was never
    // estimated. The count is what tells the picker otherwise.
    const [snapshot] = await listScopeSnapshots(projectId, db);
    expect(snapshot).toMatchObject({
      estimatedMinutes: 0,
      unestimatedCount: 0,
      negativeEstimateCount: 1,
    });
  });

  it("counts a zero as unsized rather than as negative", async () => {
    await createScopeSnapshot(
      {
        projectId,
        contractValueCents: 0,
        lines: [LINES[0], { ...LINES[1], estimatedMinutes: 0 }],
      },
      db,
    );

    const [snapshot] = await listScopeSnapshots(projectId, db);
    expect(snapshot).toMatchObject({
      unestimatedCount: 1,
      negativeEstimateCount: 0,
    });
  });
});

describe("captureScopeSnapshot", () => {
  it("records the project's scope list as it stands", async () => {
    await createDeliverable(
      { projectId, title: "Discovery", estimatedMinutes: 480 },
      db,
    );
    await createDeliverable(
      { projectId, title: "Build", estimatedMinutes: 2_400 },
      db,
    );

    const result = await captureScopeSnapshot(
      projectId,
      { label: "Signed proposal" },
      db,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lineCount).toBe(2);
    const lines = await listSnapshotLines(result.snapshot.id, db);
    expect(lines.map((line) => line.title)).toEqual(["Discovery", "Build"]);
  });

  it("pairs each line with the deliverable it was copied from", async () => {
    const written = await createDeliverable(
      { projectId, title: "Discovery", estimatedMinutes: 480 },
      db,
    );

    const result = await captureScopeSnapshot(projectId, {}, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [line] = await listSnapshotLines(result.snapshot.id, db);
    expect(line.deliverableId).toBe(written.id);
  });

  it("records what the project was agreed for at that moment", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);

    const result = await captureScopeSnapshot(projectId, {}, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Read off the project inside the same transaction, so the scope and the
    // price are true at the same instant.
    expect(result.snapshot.contractValueCents).toBe(500_000);
  });

  it("records the status each line was in rather than resetting it", async () => {
    await createDeliverable(
      { projectId, title: "Discovery", status: "done" },
      db,
    );

    const result = await captureScopeSnapshot(projectId, {}, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [line] = await listSnapshotLines(result.snapshot.id, db);
    expect(line.status).toBe("done");
  });

  it("refuses a second snapshot of a scope list that has not moved", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    await captureScopeSnapshot(projectId, {}, db);

    // What bounds the table: a press can only add a row when something has
    // actually changed.
    expect(await captureScopeSnapshot(projectId, {}, db)).toEqual({
      ok: false,
      reason: "unchanged-since",
    });
    expect(await listScopeSnapshots(projectId, db)).toHaveLength(1);
  });

  it("records a second snapshot once a line has been added", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    await captureScopeSnapshot(projectId, {}, db);
    await createDeliverable({ projectId, title: "Build" }, db);

    expect((await captureScopeSnapshot(projectId, {}, db)).ok).toBe(true);
  });

  it("records a second snapshot once an estimate has moved", async () => {
    const written = await createDeliverable(
      { projectId, title: "Discovery", estimatedMinutes: 480 },
      db,
    );
    await captureScopeSnapshot(projectId, {}, db);
    await updateDeliverable(written.id, { estimatedMinutes: 960 }, db);

    expect((await captureScopeSnapshot(projectId, {}, db)).ok).toBe(true);
  });

  it("records a second snapshot once the price has moved", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    await captureScopeSnapshot(projectId, {}, db);
    await db
      .update(projects)
      .set({ contractValueCents: 650_000 })
      .where(eq(projects.id, projectId));

    // The scope list is untouched, which is exactly the case a snapshot
    // recording only the deliverables could not tell apart.
    expect((await captureScopeSnapshot(projectId, {}, db)).ok).toBe(true);
  });

  it("ignores another project's snapshot when deciding", async () => {
    const client = await createClient({ name: "Other Co" }, db);
    const other = await createProject(
      { clientId: client.id, name: "Something else" },
      db,
    );
    await createDeliverable({ projectId: other.id, title: "Discovery" }, db);
    await captureScopeSnapshot(other.id, {}, db);
    await createDeliverable({ projectId, title: "Discovery" }, db);

    expect((await captureScopeSnapshot(projectId, {}, db)).ok).toBe(true);
  });

  it("refuses a project nobody has agreed anything for", async () => {
    expect(await captureScopeSnapshot(projectId, {}, db)).toEqual({
      ok: false,
      reason: "empty-scope",
    });
  });

  it("refuses a project that no longer exists", async () => {
    expect(await captureScopeSnapshot("prj_gone", {}, db)).toEqual({
      ok: false,
      reason: "no-such-project",
    });
  });

  it("records a hand-edited negative estimate as it stands", async () => {
    const written = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    await db
      .update(deliverables)
      .set({ estimatedMinutes: -120 })
      .where(eq(deliverables.id, written.id));

    const result = await captureScopeSnapshot(projectId, {}, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [line] = await listSnapshotLines(result.snapshot.id, db);
    expect(line.estimatedMinutes).toBe(-120);
  });

  it("refuses a fraction of a minute, and writes nothing", async () => {
    const written = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    await db
      .update(deliverables)
      .set({ estimatedMinutes: 90.5 })
      .where(eq(deliverables.id, written.id));

    expect(await captureScopeSnapshot(projectId, {}, db)).toEqual({
      ok: false,
      reason: "unrecordable-scope",
    });
    expect(await db.select().from(scopeSnapshots)).toEqual([]);
  });

  it("refuses a contract value the snapshot column would not take", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    await db
      .update(projects)
      .set({ contractValueCents: -1 })
      .where(eq(projects.id, projectId));

    expect(await captureScopeSnapshot(projectId, {}, db)).toEqual({
      ok: false,
      reason: "unrecordable-value",
    });
  });

  it("leaves the project's own scope list untouched", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);

    await captureScopeSnapshot(projectId, {}, db);

    const scope = await db
      .select()
      .from(deliverables)
      .where(eq(deliverables.projectId, projectId));
    expect(scope).toHaveLength(1);
  });
});

describe("latestScopeSnapshot", () => {
  it("reads the most recent snapshot of the project", async () => {
    await createScopeSnapshot(
      { projectId, label: "At signing", contractValueCents: 0, lines: LINES },
      db,
    );
    await tick();
    const second = await createScopeSnapshot(
      { projectId, label: "Later", contractValueCents: 650_000, lines: LINES },
      db,
    );

    expect(await latestScopeSnapshot(projectId, db)).toEqual(second);
  });

  it("agrees with the head of the list the picker reads", async () => {
    await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );
    await tick();
    await createScopeSnapshot(
      { projectId, contractValueCents: 0, lines: LINES },
      db,
    );

    const [newest] = await listScopeSnapshots(projectId, db);
    expect((await latestScopeSnapshot(projectId, db))?.id).toBe(newest.id);
  });

  it("answers null for a project never snapshotted", async () => {
    expect(await latestScopeSnapshot(projectId, db)).toBeNull();
  });

  it("ignores another project's snapshots", async () => {
    const client = await createClient({ name: "Other Co" }, db);
    const other = await createProject(
      { clientId: client.id, name: "Something else" },
      db,
    );
    await createScopeSnapshot(
      { projectId: other.id, contractValueCents: 0, lines: LINES },
      db,
    );

    expect(await latestScopeSnapshot(projectId, db)).toBeNull();
  });
});
