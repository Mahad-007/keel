import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  applyTemplateToProject,
  listDeliverableTemplates,
  saveTemplateFromProject,
} from "@/lib/data/deliverable-templates";
import {
  createDeliverable,
  listDeliverables,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { summariseScope } from "@/lib/scope";

import { templateOptionLabel } from "./options";
import { templateSize } from "./summary";

/**
 * The whole point of the feature, end to end: a scope list saved off one
 * project and applied to another should produce the same list.
 *
 * Each half is tested on its own where it lives. This is the seam between
 * them, and it is the one a reader actually cares about — the promise the
 * picker makes is that the next engagement starts where the last one did, and
 * a copy that quietly dropped a line or an estimate would keep that promise
 * right up until somebody invoiced against it.
 */

let db: Database;
let source: string;
let destination: string;

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Anvil Co" }, db)).id;
  source = (
    await createProject(
      { clientId, name: "Harbour rebuild", contractValueCents: 1_200_000 },
      db,
    )
  ).id;
  destination = (
    await createProject({ clientId, name: "Second rebuild" }, db)
  ).id;

  await createDeliverable(
    {
      projectId: source,
      title: "Discovery",
      description: "Two workshops and a written brief.",
      estimatedMinutes: 480,
    },
    db,
  );
  await createDeliverable(
    { projectId: source, title: "Build", estimatedMinutes: 2_400 },
    db,
  );
  await createDeliverable(
    { projectId: source, title: "Handover", estimatedMinutes: 120 },
    db,
  );
});

async function roundTrip() {
  const saved = await saveTemplateFromProject(
    source,
    { name: "Harbour rebuild" },
    db,
  );
  if (!saved.ok) throw new Error(`capture refused: ${saved.reason}`);

  const applied = await applyTemplateToProject(saved.template.id, destination, db);
  if (!applied.ok) throw new Error(`apply refused: ${applied.reason}`);

  return { templateId: saved.template.id };
}

describe("saving a scope list and applying it to another project", () => {
  it("reproduces the titles, the detail, the estimates and the order", async () => {
    await roundTrip();

    const before = await listDeliverables(source, db);
    const after = await listDeliverables(destination, db);

    expect(
      after.map(({ title, description, estimatedMinutes, sortOrder }) => ({
        title,
        description,
        estimatedMinutes,
        sortOrder,
      })),
    ).toEqual(
      before.map(({ title, description, estimatedMinutes, sortOrder }) => ({
        title,
        description,
        estimatedMinutes,
        sortOrder,
      })),
    );
  });

  it("gives the new project the same estimated total", async () => {
    await roundTrip();

    const before = summariseScope(await listDeliverables(source, db), 0);
    const after = summariseScope(await listDeliverables(destination, db), 0);

    expect(after.estimatedMinutes).toBe(before.estimatedMinutes);
    expect(after.unestimatedCount).toBe(before.unestimatedCount);
  });

  it("does not carry progress across, however far the source project got", async () => {
    const [discovery, build] = await listDeliverables(source, db);
    await setDeliverableStatus(discovery.id, "pending", "done", db);
    await setDeliverableStatus(build.id, "pending", "started", db);

    await roundTrip();

    const after = await listDeliverables(destination, db);
    expect(after.map((line) => line.status)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
    // Which is the point: the new project has everything still to do.
    expect(summariseScope(after, 0).remainingMinutes).toBe(3_000);
  });

  it("leaves the source project exactly as it was", async () => {
    const before = await listDeliverables(source, db);

    await roundTrip();

    expect(await listDeliverables(source, db)).toEqual(before);
  });

  it("offers the template on the picker with the size it was captured at", async () => {
    await roundTrip();

    const [summary] = await listDeliverableTemplates(db);
    const captured = templateSize(await listDeliverables(source, db));

    expect(summary.lineCount).toBe(captured.lineCount);
    expect(summary.estimatedMinutes).toBe(captured.estimatedMinutes);
    expect(templateOptionLabel(summary)).toBe(
      "Harbour rebuild · 3 deliverables · 50h",
    );
  });
});
