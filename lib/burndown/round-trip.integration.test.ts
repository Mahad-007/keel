import { beforeEach, describe, expect, it } from "vitest";

import { summariseBurn } from "@/lib/burn";
import {
  backfillProjectBurn,
  captureProjectBurn,
  listBurnSnapshots,
} from "@/lib/data/burn-snapshots";
import { createClient } from "@/lib/data/clients";
import { createProject, updateProject } from "@/lib/data/projects";
import {
  createTimeEntry,
  dailyProjectTimeTotals,
  projectTimeTotals,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { resolveRate } from "@/lib/rates";

import { burnSeries, recordedBurnPoint } from "./series";

/**
 * The whole point of the table, end to end: a day's burn recorded as it stood,
 * read back later, and still saying what it said — including after the rate it
 * was worked out at has moved.
 *
 * Each half is tested where it lives. This is the seam, and it is the one that
 * matters: the promise a burn-down makes is that the past is the past, and a
 * chart recomputed from today's columns would keep that promise right up until
 * somebody corrected a rate.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Anvil Co" }, db)).id;
  projectId = (
    await createProject(
      {
        clientId,
        name: "Site rebuild",
        contractValueCents: 500_000,
        rateCents: 15_000,
      },
      db,
    )
  ).id;

  // Three days of work: an hour, then two, then half an hour.
  await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-14" }, db);
  await createTimeEntry({ projectId, minutes: 120, workedOn: "2026-10-15" }, db);
  await createTimeEntry({ projectId, minutes: 30, workedOn: "2026-10-16" }, db);
});

/** Readings taken as each day ended, which is what the daily job would do. */
async function recordEachDay(): Promise<void> {
  for (const onDate of ["2026-10-14", "2026-10-15", "2026-10-16"]) {
    await captureProjectBurn(projectId, onDate, { today: onDate }, db);
  }
}

describe("a recorded burn-down", () => {
  it("reads back as the line that was recorded", async () => {
    await recordEachDay();

    const points = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );

    expect(points.map((point) => [point.onDate, point.burnedCents])).toEqual([
      ["2026-10-14", 15_000],
      ["2026-10-15", 45_000],
      ["2026-10-16", 52_500],
    ]);
  });

  it("agrees with the series computed from the entries", async () => {
    await recordEachDay();

    const stored = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );
    const live = burnSeries(
      await dailyProjectTimeTotals(projectId, db),
      500_000,
      resolveRate({ rateCents: 15_000 }, null),
    );

    expect(stored).toEqual(live);
  });

  it("ends where the overview panel's figure is", async () => {
    await recordEachDay();

    const stored = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );
    const panel = summariseBurn(
      await projectTimeTotals(projectId, db),
      500_000,
      resolveRate({ rateCents: 15_000 }, null),
    );

    const last = stored[stored.length - 1];
    expect(last.burnedCents).toBe(panel.burnedCents);
    expect(last.remainingCents).toBe(panel.remainingCents);
    expect(last.consumedShare).toBe(panel.consumedShare);
  });

  it("keeps the past at the rate the past was billed at", async () => {
    await recordEachDay();
    await updateProject(projectId, { rateCents: 30_000 }, db);

    const points = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );

    // Doubling the rate does not double the history. This is the one claim the
    // stored table makes that a recomputed chart cannot.
    expect(points.map((point) => point.burnedCents)).toEqual([
      15_000, 45_000, 52_500,
    ]);
    expect(points.every((point) => point.rate.cents === 15_000)).toBe(true);
  });

  it("keeps the past at the price the past was measured against", async () => {
    await recordEachDay();
    await updateProject(projectId, { contractValueCents: 1_000_000 }, db);

    const points = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );

    expect(points.every((point) => point.contractedCents === 500_000)).toBe(
      true,
    );
    expect(points[2].remainingCents).toBe(447_500);
  });

  it("moves a day's reading when the day's time is corrected", async () => {
    await recordEachDay();
    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-15" }, db);
    await captureProjectBurn(projectId, "2026-10-15", { today: "2026-10-15" }, db);

    const points = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );

    // Re-reading one day moves that day and nothing else, which leaves the
    // line briefly falling: the 16th still holds the total it was read at.
    // A burn-down is a record of readings rather than a view over the entries,
    // and this is the state the repair below exists to resolve.
    expect(points.map((point) => point.burnedCents)).toEqual([
      15_000, 60_000, 52_500,
    ]);
  });

  it("climbs again once the days after the correction are repaired", async () => {
    await recordEachDay();
    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-15" }, db);

    const result = await backfillProjectBurn(
      projectId,
      { through: "2026-10-16" },
      db,
    );

    expect(result).toMatchObject({ written: 0, repaired: 2 });
    const points = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );
    expect(points.map((point) => point.burnedCents)).toEqual([
      15_000, 60_000, 67_500,
    ]);
    // The day the correction did not touch is still the reading it was.
    expect(points[0].rate.source).toBe("project");
  });
});
