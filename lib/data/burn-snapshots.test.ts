import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { BurnPoint } from "@/lib/burndown/series";
import type { Database } from "@/lib/db";
import { burnSnapshots } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import { recordBurnSnapshot } from "./burn-snapshots";
import { createClient } from "./clients";
import { createProject } from "./projects";

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
