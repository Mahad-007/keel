import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  deleteDeliverable,
  listDeliverables,
  setDeliverableStatus,
  updateDeliverable,
} from "@/lib/data/deliverables";
import { createProject, getProject, updateProject } from "@/lib/data/projects";
import {
  captureScopeSnapshot,
  listScopeSnapshots,
  listSnapshotLines,
} from "@/lib/data/scope-snapshots";
import type { Database } from "@/lib/db";
import { deliverables } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import { describeScopeDiff } from "./describe";
import { diffScope } from "./diff";
import { snapshotSize } from "./summary";

/**
 * The whole point of the feature, end to end: a scope list recorded at one
 * moment, edited afterwards, and the comparison naming exactly what moved.
 *
 * Each half is tested on its own where it lives. This is the seam between
 * them, and it is the one that matters — the promise the page makes is that
 * what was agreed is still on record, and a snapshot that quietly tracked the
 * edits would keep that promise right up until somebody needed it.
 */

let db: Database;
let projectId: string;
/** The scope list as it was agreed, by title. */
let agreed: Record<string, string>;

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Anvil Co" }, db)).id;
  projectId = (
    await createProject(
      { clientId, name: "Harbour rebuild", contractValueCents: 1_200_000 },
      db,
    )
  ).id;

  const lines = [
    { title: "Discovery", estimatedMinutes: 480 },
    { title: "Build", estimatedMinutes: 2_400 },
    { title: "Old blog import", estimatedMinutes: 360 },
  ];
  agreed = {};
  for (const line of lines) {
    const written = await createDeliverable({ projectId, ...line }, db);
    agreed[line.title] = written.id;
  }
});

/** The comparison the scope tab would show, read the way the page reads it. */
async function compare() {
  const [snapshot] = await listScopeSnapshots(projectId, db);
  const [lines, deliverables] = await Promise.all([
    listSnapshotLines(snapshot.id, db),
    listDeliverables(projectId, db),
  ]);
  const project = await getProject(projectId, db);

  return diffScope(
    { lines, contractValueCents: snapshot.contractValueCents },
    { lines: deliverables, contractValueCents: project!.contractValueCents },
  );
}

describe("a scope list recorded and then edited", () => {
  beforeEach(async () => {
    await captureScopeSnapshot(projectId, { label: "Signed proposal" }, db);
  });

  it("reports nothing changed while nothing has", async () => {
    const diff = await compare();

    expect(diff.summary.hasChanges).toBe(false);
    expect(diff.summary.unchangedCount).toBe(3);
  });

  it("reports a line agreed afterwards as added", async () => {
    await createDeliverable(
      { projectId, title: "Analytics", estimatedMinutes: 240 },
      db,
    );

    const diff = await compare();
    const added = diff.entries.filter((entry) => entry.kind === "added");

    expect(added.map((entry) => entry.after?.title)).toEqual(["Analytics"]);
    expect(diff.summary.estimatedMinutesDelta).toBe(240);
  });

  it("still names a line that has since been deleted", async () => {
    await deleteDeliverable(agreed["Old blog import"], db);

    const diff = await compare();
    const [dropped] = diff.entries.filter((entry) => entry.kind === "removed");

    // The deliverable row is gone; the snapshot is the only place its title
    // and its estimate still exist.
    expect(dropped.before).toMatchObject({
      title: "Old blog import",
      estimatedMinutes: 360,
    });
    expect(diff.summary.estimatedMinutesDelta).toBe(-360);
  });

  it("reports a re-estimated line as one change rather than two", async () => {
    await updateDeliverable(agreed.Build, { estimatedMinutes: 3_600 }, db);

    const diff = await compare();

    expect(diff.summary).toMatchObject({
      addedCount: 0,
      removedCount: 0,
      changedCount: 1,
      unchangedCount: 2,
      estimatedMinutesDelta: 1_200,
    });
  });

  it("reports a retitled line as the same deliverable", async () => {
    await updateDeliverable(agreed.Discovery, { title: "Discovery phase" }, db);

    const diff = await compare();
    const [changed] = diff.entries.filter((entry) => entry.kind === "changed");

    expect(changed.changes).toEqual([
      { field: "title", before: "Discovery", after: "Discovery phase" },
    ]);
  });

  it("reports work delivered since, without moving the totals", async () => {
    await setDeliverableStatus(agreed.Discovery, "pending", "done", db);

    const diff = await compare();

    expect(diff.summary.changedCount).toBe(1);
    expect(diff.summary.estimatedMinutesDelta).toBe(0);
  });

  it("survives a reorder of the scope list without reporting one", async () => {
    await deleteDeliverable(agreed.Discovery, db);
    await createDeliverable(
      { projectId, title: "Discovery", estimatedMinutes: 480 },
      db,
    );

    const diff = await compare();

    // The two remaining lines were renumbered by the delete, and neither of
    // them is reported — a position is not part of the comparison.
    expect(
      diff.entries.filter((entry) => entry.kind === "changed"),
    ).toHaveLength(0);
  });

  it("says the price held while the scope grew, which is the point", async () => {
    await createDeliverable(
      { projectId, title: "Analytics", estimatedMinutes: 480 },
      db,
    );

    const sentence = describeScopeDiff((await compare()).summary);

    expect(sentence).toContain("1 deliverable added");
    expect(sentence).toContain("The estimate is up 8 hours");
    expect(sentence).toContain(
      "The contract value is unchanged, at $12,000.00",
    );
  });

  it("reports a price rise against the scope it was agreed for", async () => {
    await updateProject(projectId, { contractValueCents: 1_500_000 }, db);

    const diff = await compare();

    // The snapshot's own column is what makes this visible: the project row
    // now says $15,000 and said $12,000 when the scope was recorded.
    expect(diff.summary).toMatchObject({
      contractValueCentsBefore: 1_200_000,
      contractValueCentsAfter: 1_500_000,
      contractValueCentsDelta: 300_000,
      hasChanges: true,
    });
  });
});

describe("the figures the snapshot list reports", () => {
  it("agrees with the lines it summarised", async () => {
    await captureScopeSnapshot(projectId, {}, db);

    const [summarised] = await listScopeSnapshots(projectId, db);
    const lines = await listSnapshotLines(summarised.id, db);

    // The aggregates are counted in SQL so a picker does not read every line;
    // this is the definition they are held to.
    expect(snapshotSize(lines)).toEqual({
      lineCount: summarised.lineCount,
      estimatedMinutes: summarised.estimatedMinutes,
      unestimatedCount: summarised.unestimatedCount,
      negativeEstimateCount: summarised.negativeEstimateCount,
    });
  });

  it("agrees when a line was never estimated", async () => {
    await createDeliverable({ projectId, title: "Handover" }, db);
    await captureScopeSnapshot(projectId, {}, db);

    const [summarised] = await listScopeSnapshots(projectId, db);
    const lines = await listSnapshotLines(summarised.id, db);

    expect(snapshotSize(lines)).toEqual({
      lineCount: summarised.lineCount,
      estimatedMinutes: summarised.estimatedMinutes,
      unestimatedCount: summarised.unestimatedCount,
      negativeEstimateCount: summarised.negativeEstimateCount,
    });
    expect(summarised.unestimatedCount).toBe(1);
  });

  it("agrees when a captured line was hand-edited below zero", async () => {
    // The form refuses a negative estimate, so this is the only way such a
    // row exists — and a snapshot copies it rather than repairing it.
    await db
      .update(deliverables)
      .set({ estimatedMinutes: -120 })
      .where(eq(deliverables.id, agreed["Old blog import"]));
    await captureScopeSnapshot(projectId, {}, db);

    const [summarised] = await listScopeSnapshots(projectId, db);
    const lines = await listSnapshotLines(summarised.id, db);

    expect(snapshotSize(lines)).toEqual({
      lineCount: summarised.lineCount,
      estimatedMinutes: summarised.estimatedMinutes,
      unestimatedCount: summarised.unestimatedCount,
      negativeEstimateCount: summarised.negativeEstimateCount,
    });
    expect(summarised.negativeEstimateCount).toBe(1);
    expect(summarised.unestimatedCount).toBe(0);
  });
});
