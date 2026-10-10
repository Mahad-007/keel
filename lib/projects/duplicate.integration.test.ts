import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createDeliverable, listDeliverables } from "@/lib/data/deliverables";
import {
  createProject,
  duplicateProject,
  getProject,
  transitionProject,
} from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { summariseScope } from "@/lib/scope";

/**
 * The whole point of the feature, end to end: a half-finished engagement
 * copied as the next one should read as agreed but not started.
 *
 * Each half is tested where it lives. This is the seam, and it is the one a
 * reader cares about — the promise the button makes is that the copy is the
 * work as it was agreed, and a copy that quietly carried two done lines would
 * keep that promise right up until somebody read its scope summary and
 * believed it was half delivered.
 */

let db: Database;
let clientId: string;
let source: string;

beforeEach(async () => {
  db = await createTestDb();
  clientId = (await createClient({ name: "Harbour Co" }, db)).id;
  source = (
    await createProject(
      {
        clientId,
        name: "Harbour Co — site rebuild",
        contractValueCents: 1_200_000,
        rateCents: 9_500,
      },
      db,
    )
  ).id;

  await createDeliverable(
    {
      projectId: source,
      title: "Discovery",
      description: "Two workshops.",
      estimatedMinutes: 480,
      status: "done",
    },
    db,
  );
  await createDeliverable(
    {
      projectId: source,
      title: "Build",
      estimatedMinutes: 2_400,
      status: "started",
    },
    db,
  );
  await createDeliverable(
    { projectId: source, title: "Handover", estimatedMinutes: 0 },
    db,
  );

  // The source is live work, part way through, with a trail behind it.
  await transitionProject(source, "active", {}, db);
  await transitionProject(source, "paused", { reason: "Awaiting copy." }, db);
});

/** The copy, or a failure: every test below starts with one. */
async function copy() {
  const result = await duplicateProject(source, { name: "Phase two" }, db);
  if (!result.ok) throw new Error(`expected a copy, got ${result.reason}`);
  return result.project;
}

/**
 * What the scope panel would say about each project, which is the product's
 * own reading of what crossed over.
 */
async function summaries(copyId: string, copyValueCents: number) {
  return {
    before: summariseScope(await listDeliverables(source, db), 1_200_000),
    after: summariseScope(await listDeliverables(copyId, db), copyValueCents),
  };
}

describe("duplicating a half-finished project", () => {
  it("agrees the same scope at the same value", async () => {
    const project = await copy();

    const { before, after } = await summaries(
      project.id,
      project.contractValueCents,
    );

    expect(after.lineCount).toBe(before.lineCount);
    expect(after.estimatedMinutes).toBe(before.estimatedMinutes);
    expect(after.contractValueCents).toBe(before.contractValueCents);
  });

  it("reads as nothing delivered where the source reads as part done", async () => {
    const project = await copy();

    const { before, after } = await summaries(
      project.id,
      project.contractValueCents,
    );

    expect(before.deliveredCount).toBe(1);
    expect(after.deliveredCount).toBe(0);
    expect(after.remainingMinutes).toBe(after.estimatedMinutes);
  });

  it("leaves the copy a draft that has not started", async () => {
    const written = await getProject((await copy()).id, db);

    expect(written?.status).toBe("draft");
    expect(written?.startedAt).toBeNull();
  });

  it("leaves the source paused and part done", async () => {
    await copy();

    const original = await getProject(source, db);

    expect(original?.status).toBe("paused");
    expect(
      (await listDeliverables(source, db)).map((line) => line.status),
    ).toEqual(["done", "started", "pending"]);
  });
});
