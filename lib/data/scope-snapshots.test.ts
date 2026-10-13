import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { scopeSnapshots } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";
import type { SnapshotLineDraft } from "@/lib/snapshots/capture";

import { createClient } from "./clients";
import { createProject } from "./projects";
import {
  createScopeSnapshot,
  getScopeSnapshot,
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
      createScopeSnapshot(
        { projectId, contractValueCents: 0, lines: [] },
        db,
      ),
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

describe("getScopeSnapshot", () => {
  it("reads a snapshot back by id", async () => {
    const written = await createScopeSnapshot(
      { projectId, label: "At signing", contractValueCents: 0, lines: LINES },
      db,
    );

    expect(await getScopeSnapshot(written.id, db)).toEqual(written);
  });

  it("answers null for an id nothing was written under", async () => {
    expect(await getScopeSnapshot("snp_nope", db)).toBeNull();
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
