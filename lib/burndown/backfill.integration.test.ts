import { beforeEach, describe, expect, it } from "vitest";

import {
  backfillBurnSnapshots,
  captureProjectBurn,
  listBurnSnapshots,
} from "@/lib/data/burn-snapshots";
import { createClient } from "@/lib/data/clients";
import { createProject } from "@/lib/data/projects";
import { createTimeEntry } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { recordedBurnPoint } from "./series";

/**
 * The backfill against the case it was written for: a studio that has been
 * logging time for months and has no burn-down at all, because the table did
 * not exist while the work was happening.
 *
 * The per-project pieces are tested in the data layer. This is the claim the
 * milestone makes — run it once and every engagement has a line — and the two
 * things that claim has to survive: being run twice, and being run beside the
 * daily capture it is a stand-in for.
 */

let db: Database;
/** A six-week engagement, worked on a dozen days. */
let projectId: string;

const WORKED_DAYS = [
  "2026-09-01",
  "2026-09-02",
  "2026-09-04",
  "2026-09-08",
  "2026-09-15",
  "2026-09-16",
  "2026-09-30",
  "2026-10-01",
  "2026-10-05",
  "2026-10-12",
];

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Harbour Co" }, db)).id;
  projectId = (
    await createProject(
      {
        clientId,
        name: "Brand refresh",
        contractValueCents: 400_000,
        rateCents: 12_000,
      },
      db,
    )
  ).id;

  // Two hours a day, every day worked, and nothing recorded as it happened.
  for (const workedOn of WORKED_DAYS) {
    await createTimeEntry({ projectId, minutes: 120, workedOn }, db);
  }
});

describe("backfilling a studio that predates the table", () => {
  it("gives an engagement a line where it had none", async () => {
    expect(await listBurnSnapshots(projectId, db)).toEqual([]);

    const report = await backfillBurnSnapshots({ through: "2026-10-31" }, db);

    expect(report.written).toBe(WORKED_DAYS.length);
    expect((await listBurnSnapshots(projectId, db)).map((r) => r.onDate)).toEqual(
      WORKED_DAYS,
    );
  });

  it("builds a line that only ever climbs", async () => {
    await backfillBurnSnapshots({ through: "2026-10-31" }, db);

    const burned = (await listBurnSnapshots(projectId, db)).map(
      (row) => row.burnedCents,
    );

    expect(burned).toEqual([
      24_000, 48_000, 72_000, 96_000, 120_000, 144_000, 168_000, 192_000,
      216_000, 240_000,
    ]);
    expect(burned.every((cents, at) => at === 0 || cents > burned[at - 1])).toBe(
      true,
    );
  });

  it("ends on the figure the overview panel shows today", async () => {
    await backfillBurnSnapshots({ through: "2026-10-31" }, db);

    const points = (await listBurnSnapshots(projectId, db)).map(
      recordedBurnPoint,
    );
    const last = points[points.length - 1];

    // Twenty hours at $120 of a $4,000 contract: 60% gone.
    expect(last.loggedMinutes).toBe(1200);
    expect(last.remainingCents).toBe(160_000);
    expect(last.consumedShare).toBeCloseTo(0.6);
  });

  it("says every point is a reconstruction", async () => {
    await backfillBurnSnapshots({ through: "2026-10-31" }, db);

    expect(
      (await listBurnSnapshots(projectId, db)).every(
        (row) => row.origin === "backfilled",
      ),
    ).toBe(true);
  });

  it("is safe to run again, and says it did nothing", async () => {
    await backfillBurnSnapshots({ through: "2026-10-31" }, db);
    const second = await backfillBurnSnapshots({ through: "2026-10-31" }, db);

    expect(second).toMatchObject({
      written: 0,
      alreadyRecorded: WORKED_DAYS.length,
      refused: 0,
    });
    expect(await listBurnSnapshots(projectId, db)).toHaveLength(
      WORKED_DAYS.length,
    );
  });

  it("hands over to the daily capture without a seam", async () => {
    await backfillBurnSnapshots({ through: "2026-10-12" }, db);

    // The next two days are recorded as they happen, the second of them quiet.
    await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-13" },
      db,
    );
    await captureProjectBurn(projectId, "2026-10-13", { today: "2026-10-13" }, db);
    await captureProjectBurn(projectId, "2026-10-14", { today: "2026-10-14" }, db);

    const rows = await listBurnSnapshots(projectId, db);

    expect(rows.map((row) => row.onDate).slice(-3)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    expect(rows.map((row) => row.burnedCents).slice(-3)).toEqual([
      240_000, 252_000, 252_000,
    ]);
    expect(rows.map((row) => row.origin).slice(-3)).toEqual([
      "backfilled",
      "recorded",
      "recorded",
    ]);
  });

  it("reconstructs only as far as the day it is run", async () => {
    const report = await backfillBurnSnapshots({ through: "2026-09-16" }, db);

    expect(report.written).toBe(6);
    expect(
      (await listBurnSnapshots(projectId, db)).map((row) => row.onDate),
    ).toEqual(WORKED_DAYS.slice(0, 6));
  });

  it("finishes the job when it is run again later", async () => {
    await backfillBurnSnapshots({ through: "2026-09-16" }, db);
    const later = await backfillBurnSnapshots({ through: "2026-10-31" }, db);

    expect(later).toMatchObject({ written: 4, alreadyRecorded: 6 });
    expect(await listBurnSnapshots(projectId, db)).toHaveLength(
      WORKED_DAYS.length,
    );
  });
});
