import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createDeliverable } from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import { createTimeEntry, listTimeEntries } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { groupTimeByDay, totalMinutes } from "./days";

/**
 * The seam between the order the data layer hands time back in and the days
 * the list draws from it.
 *
 * The grouping takes the caller's order on trust — it does not sort — so the
 * two have to agree about what "newest first" means, and the running totals
 * have to come out right over rows a real query ordered rather than over an
 * array a test wrote in the order it wanted.
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

/** Logged in the order somebody would have typed them, not in date order. */
async function logged(entries: readonly [number, string][]) {
  for (const [minutes, workedOn] of entries) {
    await createTimeEntry({ projectId, minutes, workedOn }, db);
  }
  return listTimeEntries(projectId, db);
}

describe("a project's time as the list draws it", () => {
  it("puts the newest day first, as the query ordered it", async () => {
    const entries = await logged([
      [60, "2026-10-14"],
      [90, "2026-10-17"],
      [30, "2026-10-16"],
    ]);

    const days = groupTimeByDay(entries);

    expect(days.map((day) => day.workedOn)).toEqual([
      "2026-10-17",
      "2026-10-16",
      "2026-10-14",
    ]);
  });

  it("gathers a day's entries however they were typed up", async () => {
    const entries = await logged([
      [60, "2026-10-17"],
      [30, "2026-10-16"],
      [45, "2026-10-17"],
    ]);

    const days = groupTimeByDay(entries);

    expect(days).toHaveLength(2);
    expect(days[0].minutes).toBe(105);
  });

  it("counts the running total back down to the first day worked", async () => {
    const entries = await logged([
      [60, "2026-10-17"],
      [30, "2026-10-16"],
      [90, "2026-10-14"],
    ]);

    const days = groupTimeByDay(entries);

    expect(days.map((day) => day.runningMinutes)).toEqual([180, 120, 90]);
    expect(days[0].runningMinutes).toBe(totalMinutes(entries));
  });

  it("keeps the figures right once an entry is attributed to a line", async () => {
    // The attribution is a column the grouping does not read, which is the
    // point: it must not change a single total.
    const deliverable = await createDeliverable(
      { projectId, title: "Wireframes" },
      db,
    );
    await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 90,
        workedOn: "2026-10-17",
      },
      db,
    );
    await createTimeEntry({ projectId, minutes: 30, workedOn: "2026-10-17" }, db);

    const [day] = groupTimeByDay(await listTimeEntries(projectId, db));

    expect(day.minutes).toBe(120);
    expect(day.billableMinutes).toBe(120);
  });

  it("leaves non-chargeable time out of the chargeable figure only", async () => {
    await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17", billable: false },
      db,
    );
    await createTimeEntry({ projectId, minutes: 30, workedOn: "2026-10-17" }, db);

    const [day] = groupTimeByDay(await listTimeEntries(projectId, db));

    expect(day.minutes).toBe(120);
    expect(day.billableMinutes).toBe(30);
    expect(day.runningMinutes).toBe(120);
  });

  it("has no days at all on a project nothing has been logged against", async () => {
    expect(groupTimeByDay(await listTimeEntries(projectId, db))).toEqual([]);
  });

  it("does not see another project's time", async () => {
    const other = await createProject(
      { clientId: (await createClient({ name: "Grace" }, db)).id, name: "Other" },
      db,
    );
    await createTimeEntry(
      { projectId: other.id, minutes: 600, workedOn: "2026-10-17" },
      db,
    );
    await logged([[90, "2026-10-17"]]);

    const [day] = groupTimeByDay(await listTimeEntries(projectId, db));

    expect(day.minutes).toBe(90);
  });
});
