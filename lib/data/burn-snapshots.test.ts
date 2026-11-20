import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { BurnPoint } from "@/lib/burndown/series";
import type { Database } from "@/lib/db";
import { burnSnapshots } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import { createTimeEntry } from "./time-entries";

import {
  burnSnapshotDates,
  captureProjectBurn,
  burnSnapshotDaysByProject,
  listBurnSnapshots,
  recordBurnSnapshot,
} from "./burn-snapshots";
import { createClient, updateClient } from "./clients";
import { createProject, deleteProject, updateProject } from "./projects";

let db: Database;
/** Every reading hangs off a project, which hangs off a client. */
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

/** Ten hours of a $5,000 contract at $150 an hour, as at the 14th. */
const POINT: BurnPoint = {
  onDate: "2026-10-14",
  contractedCents: 500_000,
  rate: { cents: 15_000, source: "project" },
  entryCount: 4,
  loggedMinutes: 600,
  billableMinutes: 540,
  burnedCents: 150_000,
  chargeableCents: 135_000,
  remainingCents: 350_000,
  consumedShare: 0.3,
};

/**
 * `capturedAt` comes from the wall clock, so a replacement written in the same
 * millisecond would carry the same timestamp and a test of it would pass by
 * luck.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

describe("recordBurnSnapshot", () => {
  it("stores the day and every figure of the reading", async () => {
    const snapshot = await recordBurnSnapshot({ projectId, point: POINT }, db);

    expect(snapshot).toMatchObject({
      projectId,
      onDate: "2026-10-14",
      contractValueCents: 500_000,
      rateCents: 15_000,
      rateSource: "project",
      entryCount: 4,
      loggedMinutes: 600,
      billableMinutes: 540,
      burnedCents: 150_000,
      chargeableCents: 135_000,
    });
  });

  it("stores what can be subtracted nowhere, because it is a subtraction", async () => {
    const snapshot = await recordBurnSnapshot({ projectId, point: POINT }, db);

    expect(snapshot).not.toHaveProperty("remainingCents");
    expect(snapshot).not.toHaveProperty("consumedShare");
  });

  it("calls a reading measured unless it is told otherwise", async () => {
    const snapshot = await recordBurnSnapshot({ projectId, point: POINT }, db);
    expect(snapshot.origin).toBe("recorded");
  });

  it("marks a reconstruction as one", async () => {
    const snapshot = await recordBurnSnapshot(
      { projectId, point: POINT, origin: "backfilled" },
      db,
    );
    expect(snapshot.origin).toBe("backfilled");
  });

  it("records when the reading was taken, not just the day it describes", async () => {
    const snapshot = await recordBurnSnapshot({ projectId, point: POINT }, db);

    expect(snapshot.capturedAt).not.toBe(snapshot.onDate);
    expect(snapshot.capturedAt.startsWith(new Date().toISOString().slice(0, 7))).toBe(
      true,
    );
  });

  it("keeps two days of one project apart", async () => {
    await recordBurnSnapshot({ projectId, point: POINT }, db);
    await recordBurnSnapshot(
      { projectId, point: { ...POINT, onDate: "2026-10-15" } },
      db,
    );

    const rows = await db
      .select()
      .from(burnSnapshots)
      .where(eq(burnSnapshots.projectId, projectId));
    expect(rows).toHaveLength(2);
  });

  it("replaces a day rather than recording it twice", async () => {
    const first = await recordBurnSnapshot({ projectId, point: POINT }, db);
    await tick();
    const second = await recordBurnSnapshot(
      {
        projectId,
        point: { ...POINT, loggedMinutes: 660, burnedCents: 165_000 },
      },
      db,
    );

    const rows = await db
      .select()
      .from(burnSnapshots)
      .where(eq(burnSnapshots.projectId, projectId));

    expect(rows).toHaveLength(1);
    expect(rows[0].loggedMinutes).toBe(660);
    expect(rows[0].burnedCents).toBe(165_000);
    // The row is the same reading, better informed: same id, later timestamp.
    expect(second.id).toBe(first.id);
    expect(second.capturedAt > first.capturedAt).toBe(true);
  });

  it("lets a reconstruction be replaced by a measurement", async () => {
    await recordBurnSnapshot(
      { projectId, point: POINT, origin: "backfilled" },
      db,
    );
    const replaced = await recordBurnSnapshot({ projectId, point: POINT }, db);

    expect(replaced.origin).toBe("recorded");
  });

  it("refuses a day that is a moment rather than a date", async () => {
    await expect(
      recordBurnSnapshot(
        { projectId, point: { ...POINT, onDate: "2026-10-14T09:00:00.000Z" } },
        db,
      ),
    ).rejects.toThrow(/calendar date/);
  });

  it("refuses a reading with no project", async () => {
    await expect(
      recordBurnSnapshot({ projectId: "  ", point: POINT }, db),
    ).rejects.toThrow(/burn reading project/);
  });
});

describe("recordBurnSnapshot on a project with a bad column", () => {
  it("records a burn that runs backwards rather than refusing it", async () => {
    // Only a hand-edited row bills at a negative rate, and the engagement whose
    // history looks wrong is the one somebody has to look at.
    const snapshot = await recordBurnSnapshot(
      {
        projectId,
        point: {
          ...POINT,
          rate: { cents: -15_000, source: "project" },
          burnedCents: -150_000,
          chargeableCents: -135_000,
        },
      },
      db,
    );

    expect(snapshot.rateCents).toBe(-15_000);
    expect(snapshot.burnedCents).toBe(-150_000);
  });

  it("records a contract value below zero as it stands", async () => {
    const snapshot = await recordBurnSnapshot(
      { projectId, point: { ...POINT, contractedCents: -1 } },
      db,
    );

    expect(snapshot.contractValueCents).toBe(-1);
  });

  it("records a day with no rate anywhere as a day that burned nothing", async () => {
    const snapshot = await recordBurnSnapshot(
      {
        projectId,
        point: {
          ...POINT,
          rate: { cents: 0, source: "none" },
          burnedCents: 0,
          chargeableCents: 0,
          consumedShare: 0,
        },
      },
      db,
    );

    expect(snapshot.rateSource).toBe("none");
    expect(snapshot.burnedCents).toBe(0);
    expect(snapshot.loggedMinutes).toBe(600);
  });

  it("refuses an amount too large to read back", async () => {
    await expect(
      recordBurnSnapshot(
        {
          projectId,
          point: { ...POINT, burnedCents: Number.MAX_SAFE_INTEGER + 2 },
        },
        db,
      ),
    ).rejects.toThrow(/recorded burn/);
  });

  it("refuses a count of entries that is not a count", async () => {
    await expect(
      recordBurnSnapshot({ projectId, point: { ...POINT, entryCount: -1 } }, db),
    ).rejects.toThrow(/recorded entry count/);
  });

  it("refuses a fraction of a minute", async () => {
    await expect(
      recordBurnSnapshot(
        { projectId, point: { ...POINT, loggedMinutes: 90.5 } },
        db,
      ),
    ).rejects.toThrow(/recorded minutes/);
  });
});

describe("listBurnSnapshots", () => {
  /** Three days of readings, written in an order no chart would want. */
  async function recordThreeDays(): Promise<void> {
    for (const onDate of ["2026-10-20", "2026-10-14", "2026-10-15"]) {
      await recordBurnSnapshot({ projectId, point: { ...POINT, onDate } }, db);
    }
  }

  it("is empty for a project with no readings", async () => {
    expect(await listBurnSnapshots(projectId, db)).toEqual([]);
  });

  it("comes back oldest first, which is the direction a line is drawn", async () => {
    await recordThreeDays();

    expect((await listBurnSnapshots(projectId, db)).map((r) => r.onDate)).toEqual(
      ["2026-10-14", "2026-10-15", "2026-10-20"],
    );
  });

  it("holds one row per day however often a day was recorded", async () => {
    await recordBurnSnapshot({ projectId, point: POINT }, db);
    await recordBurnSnapshot({ projectId, point: POINT }, db);

    expect(await listBurnSnapshots(projectId, db)).toHaveLength(1);
  });

  it("holds only this project's readings", async () => {
    const otherClient = await createClient({ name: "Other Co" }, db);
    const other = await createProject(
      { clientId: otherClient.id, name: "Elsewhere" },
      db,
    );
    await recordBurnSnapshot({ projectId, point: POINT }, db);
    await recordBurnSnapshot({ projectId: other.id, point: POINT }, db);

    const mine = await listBurnSnapshots(projectId, db);
    expect(mine).toHaveLength(1);
    expect(mine[0].projectId).toBe(projectId);
  });

  it("carries the origin and the moment, which a point does not", async () => {
    await recordBurnSnapshot(
      { projectId, point: POINT, origin: "backfilled" },
      db,
    );

    const [row] = await listBurnSnapshots(projectId, db);
    expect(row.origin).toBe("backfilled");
    expect(row.capturedAt).toBeTruthy();
  });

  it("goes when the project goes", async () => {
    await recordBurnSnapshot({ projectId, point: POINT }, db);
    await deleteProject(projectId, db);

    expect(await listBurnSnapshots(projectId, db)).toEqual([]);
  });
});

describe("burnSnapshotDates", () => {
  it("is empty for a project with no readings", async () => {
    expect(await burnSnapshotDates(projectId, db)).toEqual([]);
  });

  it("names every recorded day, oldest first", async () => {
    for (const onDate of ["2026-10-20", "2026-10-14"]) {
      await recordBurnSnapshot({ projectId, point: { ...POINT, onDate } }, db);
    }

    expect(await burnSnapshotDates(projectId, db)).toEqual([
      "2026-10-14",
      "2026-10-20",
    ]);
  });

  it("shows the gaps rather than only how far the history reaches", async () => {
    for (const onDate of ["2026-10-14", "2026-10-16", "2026-10-17"]) {
      await recordBurnSnapshot({ projectId, point: { ...POINT, onDate } }, db);
    }

    expect(await burnSnapshotDates(projectId, db)).not.toContain("2026-10-15");
  });

  it("names only this project's days", async () => {
    const otherClient = await createClient({ name: "Other Co" }, db);
    const other = await createProject(
      { clientId: otherClient.id, name: "Elsewhere" },
      db,
    );
    await recordBurnSnapshot({ projectId, point: POINT }, db);
    await recordBurnSnapshot(
      { projectId: other.id, point: { ...POINT, onDate: "2026-10-15" } },
      db,
    );

    expect(await burnSnapshotDates(projectId, db)).toEqual(["2026-10-14"]);
  });
});

describe("burnSnapshotDaysByProject", () => {
  it("is empty for a studio with no readings", async () => {
    expect(await burnSnapshotDaysByProject(db)).toEqual([]);
  });

  it("names each project's days against that project", async () => {
    const otherClient = await createClient({ name: "Other Co" }, db);
    const other = await createProject(
      { clientId: otherClient.id, name: "Elsewhere" },
      db,
    );
    await recordBurnSnapshot({ projectId, point: POINT }, db);
    await recordBurnSnapshot(
      { projectId: other.id, point: { ...POINT, onDate: "2026-10-15" } },
      db,
    );

    const days = await burnSnapshotDaysByProject(db);

    expect(days).toHaveLength(2);
    expect(days.find((day) => day.projectId === projectId)?.onDate).toBe(
      "2026-10-14",
    );
    expect(days.find((day) => day.projectId === other.id)?.onDate).toBe(
      "2026-10-15",
    );
  });

  it("puts one project's days in calendar order", async () => {
    for (const onDate of ["2026-10-20", "2026-10-14", "2026-10-15"]) {
      await recordBurnSnapshot({ projectId, point: { ...POINT, onDate } }, db);
    }

    expect((await burnSnapshotDaysByProject(db)).map((day) => day.onDate)).toEqual(
      ["2026-10-14", "2026-10-15", "2026-10-20"],
    );
  });

  it("agrees with the single-project read", async () => {
    for (const onDate of ["2026-10-14", "2026-10-15"]) {
      await recordBurnSnapshot({ projectId, point: { ...POINT, onDate } }, db);
    }

    expect(
      (await burnSnapshotDaysByProject(db))
        .filter((day) => day.projectId === projectId)
        .map((day) => day.onDate),
    ).toEqual(await burnSnapshotDates(projectId, db));
  });
});

describe("captureProjectBurn", () => {
  /** A rate on the project, so there is something to value hours at. */
  async function rateProject(rateCents: number): Promise<void> {
    await updateProject(projectId, { rateCents }, db);
  }

  it("values the hours logged up to that day at the project's rate", async () => {
    await rateProject(15_000);
    await createTimeEntry({ projectId, minutes: 600, workedOn: "2026-10-14" }, db);

    const result = await captureProjectBurn(projectId, "2026-10-14", db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot).toMatchObject({
      onDate: "2026-10-14",
      contractValueCents: 500_000,
      rateCents: 15_000,
      rateSource: "project",
      entryCount: 1,
      loggedMinutes: 600,
      burnedCents: 150_000,
    });
  });

  it("is cumulative: a day carries every day before it", async () => {
    await rateProject(15_000);
    await createTimeEntry({ projectId, minutes: 120, workedOn: "2026-10-14" }, db);
    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-15" }, db);

    const result = await captureProjectBurn(projectId, "2026-10-15", db);

    expect(result.ok && result.snapshot.loggedMinutes).toBe(180);
    expect(result.ok && result.snapshot.burnedCents).toBe(45_000);
  });

  it("leaves out hours logged against a later day", async () => {
    await rateProject(15_000);
    await createTimeEntry({ projectId, minutes: 120, workedOn: "2026-10-14" }, db);
    await createTimeEntry({ projectId, minutes: 600, workedOn: "2026-10-30" }, db);

    const result = await captureProjectBurn(projectId, "2026-10-14", db);

    expect(result.ok && result.snapshot.loggedMinutes).toBe(120);
  });

  it("falls back to the client's default rate", async () => {
    const client = await createClient({ name: "Rated Co" }, db);
    await updateClient(client.id, { defaultRateCents: 12_000 }, db);
    const project = await createProject(
      { clientId: client.id, name: "Retainer", contractValueCents: 100_000 },
      db,
    );
    await createTimeEntry(
      { projectId: project.id, minutes: 60, workedOn: "2026-10-14" },
      db,
    );

    const result = await captureProjectBurn(project.id, "2026-10-14", db);

    expect(result.ok && result.snapshot.rateSource).toBe("client");
    expect(result.ok && result.snapshot.burnedCents).toBe(12_000);
  });

  it("records a day with no rate anywhere as burning nothing", async () => {
    await createTimeEntry({ projectId, minutes: 600, workedOn: "2026-10-14" }, db);

    const result = await captureProjectBurn(projectId, "2026-10-14", db);

    expect(result.ok && result.snapshot.rateSource).toBe("none");
    expect(result.ok && result.snapshot.burnedCents).toBe(0);
    // The minutes are still the measurement: the gap is the missing rate.
    expect(result.ok && result.snapshot.loggedMinutes).toBe(600);
  });

  it("records a day the project had logged nothing by", async () => {
    await rateProject(15_000);
    await createTimeEntry({ projectId, minutes: 600, workedOn: "2026-10-20" }, db);

    const result = await captureProjectBurn(projectId, "2026-10-14", db);

    expect(result.ok && result.snapshot.loggedMinutes).toBe(0);
    expect(result.ok && result.snapshot.burnedCents).toBe(0);
    expect(result.ok && result.snapshot.contractValueCents).toBe(500_000);
  });

  it("keeps written-off time in the burn and out of the chargeable half", async () => {
    await rateProject(15_000);
    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-14" }, db);
    await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-14", billable: false },
      db,
    );

    const result = await captureProjectBurn(projectId, "2026-10-14", db);

    expect(result.ok && result.snapshot.burnedCents).toBe(30_000);
    expect(result.ok && result.snapshot.chargeableCents).toBe(15_000);
  });

  it("calls its own reading a measurement", async () => {
    const result = await captureProjectBurn(projectId, "2026-10-14", db);
    expect(result.ok && result.snapshot.origin).toBe("recorded");
  });

  it("replaces an earlier reading of the same day", async () => {
    await rateProject(15_000);
    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-14" }, db);
    await captureProjectBurn(projectId, "2026-10-14", db);

    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-14" }, db);
    const second = await captureProjectBurn(projectId, "2026-10-14", db);

    expect(await listBurnSnapshots(projectId, db)).toHaveLength(1);
    expect(second.ok && second.snapshot.loggedMinutes).toBe(120);
  });

  it("refuses a project that is not there", async () => {
    expect(await captureProjectBurn("prj_nope", "2026-10-14", db)).toEqual({
      ok: false,
      reason: "no-such-project",
    });
  });

  it("refuses a day that is a moment rather than a date", async () => {
    await expect(
      captureProjectBurn(projectId, "2026-10-14T09:00:00.000Z", db),
    ).rejects.toThrow(/calendar date/);
  });
});
