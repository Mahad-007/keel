import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  deleteDeliverable,
  listDeliverables,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import { createTimeEntry, listTimeEntries } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { rollUpProject } from "./rollup";

/**
 * The seam the rollup is made of: a scope list from one table and a time list
 * from another, joined on a column neither of them owns.
 *
 * `rollup.ts` is pure and its own tests say what the arithmetic does. What
 * they cannot say is that `AttributedEntry` still describes a real time row,
 * that `RolledUpDeliverable` still describes a real deliverable, or that an
 * attribution written through the data layer comes back out on the line it was
 * written to. All three are structural — the sort of thing that compiles for a
 * year and then stops when a column is renamed.
 *
 * So the rollup is taken here over rows this test actually wrote, through the
 * same two data-layer functions the project page calls.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Engine rewrite" },
    db,
  );
  projectId = project.id;
});

async function deliverable(title: string, estimatedMinutes: number) {
  return createDeliverable({ projectId, title, estimatedMinutes }, db);
}

/** The two reads the project page makes, rolled up the way the panel will. */
async function rollUp() {
  const [deliverables, entries] = await Promise.all([
    listDeliverables(projectId, db),
    listTimeEntries(projectId, db),
  ]);
  return rollUpProject(deliverables, entries);
}

describe("rolling up time written through the data layer", () => {
  it("lands each entry on the line it was attributed to", async () => {
    const build = await deliverable("Homepage build", 240);
    const revisions = await deliverable("Revision round", 120);
    await createTimeEntry(
      {
        projectId,
        deliverableId: build.id,
        minutes: 300,
        workedOn: "2026-10-17",
      },
      db,
    );
    await createTimeEntry(
      {
        projectId,
        deliverableId: revisions.id,
        minutes: 30,
        workedOn: "2026-10-18",
      },
      db,
    );

    const rolled = await rollUp();
    expect(rolled.lines.map((one) => one.title)).toEqual([
      "Homepage build",
      "Revision round",
    ]);
    expect(rolled.lines[0].loggedMinutes).toBe(300);
    expect(rolled.lines[0].varianceMinutes).toBe(60);
    expect(rolled.lines[1].loggedMinutes).toBe(30);
    expect(rolled.lines[1].varianceMinutes).toBe(-90);
  });

  it("keeps the project's totals over every entry, attributed or not", async () => {
    const build = await deliverable("Homepage build", 240);
    await createTimeEntry(
      {
        projectId,
        deliverableId: build.id,
        minutes: 120,
        workedOn: "2026-10-17",
      },
      db,
    );
    await createTimeEntry(
      { projectId, minutes: 45, workedOn: "2026-10-18" },
      db,
    );

    const rolled = await rollUp();
    expect(rolled.loggedMinutes).toBe(165);
    expect(rolled.estimatedMinutes).toBe(240);
    expect(rolled.varianceMinutes).toBe(-75);
    expect(rolled.unattributed.loggedMinutes).toBe(45);
    expect(rolled.unmatchedMinutes).toBe(0);
  });

  it("reads a line's done-ness off the status column", async () => {
    const build = await deliverable("Homepage build", 240);
    await setDeliverableStatus(build.id, "pending", "done", db);

    const rolled = await rollUp();
    expect(rolled.lines[0].delivered).toBe(true);
  });

  it("keeps the hours when the line they went against is deleted", async () => {
    // The foreign key nulls the attribution rather than taking the entry with
    // it, so the time becomes unattributed and the project total does not
    // move. Losing the hours would be the expensive outcome; losing the
    // grouping is the one the schema chooses.
    const build = await deliverable("Homepage build", 240);
    await createTimeEntry(
      {
        projectId,
        deliverableId: build.id,
        minutes: 300,
        workedOn: "2026-10-17",
      },
      db,
    );
    await deleteDeliverable(build.id, db);

    const rolled = await rollUp();
    expect(rolled.lines).toEqual([]);
    expect(rolled.loggedMinutes).toBe(300);
    expect(rolled.unattributed.loggedMinutes).toBe(300);
    expect(rolled.unmatchedMinutes).toBe(0);
  });
});
