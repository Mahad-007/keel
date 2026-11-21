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

import { burnChartArea, burnDownChart } from "./chart";
import { burnDownCaveats, describeBurnDownLine } from "./describe";
import { burnDownReadings } from "./reading";
import { burnDownRows } from "./table";

/**
 * The milestone's claim, end to end: time entries become stored readings,
 * stored readings become a picture, and the picture says what the figures
 * above it say.
 *
 * Day 035 proved the rows get written. This proves the other half — that what
 * comes back out of the table plots as a line that falls, ends where the
 * overview panel ends, and carries the caveats the history earns.
 */

let db: Database;
let projectId: string;

/** Two hours a day, every Monday of a six-week engagement. */
const WORKED_DAYS = [
  "2026-09-07",
  "2026-09-14",
  "2026-09-21",
  "2026-09-28",
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
        contractValueCents: 200_000,
        rateCents: 12_000,
      },
      db,
    )
  ).id;

  for (const workedOn of WORKED_DAYS) {
    await createTimeEntry({ projectId, minutes: 120, workedOn }, db);
  }
});

/** The chart, built the way the project page builds it. */
async function chartFromTheTable() {
  return burnDownChart(burnDownReadings(await listBurnSnapshots(projectId, db)));
}

describe("a reconstructed engagement, drawn", () => {
  beforeEach(async () => {
    await backfillBurnSnapshots({ through: "2026-10-31" }, db);
  });

  it("draws a point for every day the project was worked", async () => {
    const chart = await chartFromTheTable();
    expect(chart?.points.map((point) => point.reading.onDate)).toEqual(
      WORKED_DAYS,
    );
  });

  it("falls across the picture, from the price to what is left", async () => {
    const chart = await chartFromTheTable();
    const area = burnChartArea();

    // Twelve hours at $120 of a $2,000 contract: $560 left at the end.
    expect(chart?.points[0].y).toBeLessThan(chart!.points[5].y);
    expect(chart?.last.reading.remainingCents).toBe(56_000);
    expect(chart?.last.x).toBe(area.right);
  });

  it("spaces the weeks evenly, because they were worked evenly", async () => {
    const chart = await chartFromTheTable();
    const gaps = chart!.points
      .slice(1)
      .map((point, at) => point.x - chart!.points[at].x);
    expect(new Set(gaps.map((gap) => Math.round(gap)))).toEqual(
      new Set([Math.round(gaps[0])]),
    );
  });

  it("shades the whole plot, because the whole line is a reconstruction", async () => {
    const chart = await chartFromTheTable();
    const area = burnChartArea();
    expect(chart?.reconstructed).toEqual([
      { x: area.left, width: area.width },
    ]);
  });

  it("says in words that none of it was measured", async () => {
    const readings = burnDownReadings(await listBurnSnapshots(projectId, db));
    const [caveat] = burnDownCaveats(readings, "2026-10-12");
    expect(caveat).toContain("Every reading on this chart");
  });

  it("describes the line as the fall it is", async () => {
    const readings = burnDownReadings(await listBurnSnapshots(projectId, db));
    expect(describeBurnDownLine(readings)).toBe(
      "Falling from $1,760.00 left on Sep 7, 2026 to $560.00 on Oct 12, 2026.",
    );
  });

  it("lists every reading newest first, at full precision", async () => {
    const readings = burnDownReadings(await listBurnSnapshots(projectId, db));
    const rows = burnDownRows(readings);
    expect(rows).toHaveLength(WORKED_DAYS.length);
    expect(rows[0]).toMatchObject({
      day: "Oct 12, 2026",
      logged: "12h",
      burned: "$1,440.00",
      left: "$560.00",
      reading: "Reconstructed",
    });
  });
});

describe("a measured day on the end of a reconstruction", () => {
  beforeEach(async () => {
    await backfillBurnSnapshots({ through: "2026-10-12" }, db);
    await createTimeEntry(
      { projectId, minutes: 300, workedOn: "2026-10-19" },
      db,
    );
    await captureProjectBurn(
      projectId,
      "2026-10-19",
      { today: "2026-10-19" },
      db,
    );
  });

  it("leaves the measured day outside the shading", async () => {
    const chart = await chartFromTheTable();
    const [band] = chart!.reconstructed;
    expect(band.x + band.width).toBeLessThan(chart!.last.x);
  });

  it("names the days of the reconstructed stretch in the caveat", async () => {
    const readings = burnDownReadings(await listBurnSnapshots(projectId, db));
    expect(burnDownCaveats(readings, "2026-10-19")[0]).toContain(
      "Sep 7 – Oct 12, 2026",
    );
  });

  it("carries the overrun below the baseline once the price is gone", async () => {
    // Five more hours at $120 takes a $2,000 engagement $40 past its price.
    const chart = await chartFromTheTable();
    expect(chart?.last.reading.remainingCents).toBe(-4_000);
    expect(chart?.overrun).not.toBeNull();
    expect(chart!.last.y).toBeGreaterThan(chart!.baselineY);
  });
});

describe("a project nothing has been recorded for", () => {
  it("has no chart to draw", async () => {
    expect(await chartFromTheTable()).toBeNull();
  });
});
