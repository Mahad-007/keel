import { beforeEach, describe, expect, it } from "vitest";

import { summariseBurn } from "@/lib/burn";
import { burnDownReadings } from "@/lib/burndown/reading";
import {
  captureProjectBurn,
  listBurnSnapshots,
} from "@/lib/data/burn-snapshots";
import { createClient } from "@/lib/data/clients";
import { createDeliverable, listDeliverables } from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import { createTimeEntry, projectTimeTotals } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { resolveRate } from "@/lib/rates";

import { projectProjection } from "./projection";

/**
 * The projection against real rows, which is the seam none of the unit tests
 * can cover.
 *
 * Every piece either side of `projectProjection` is tested on its own: the
 * pace over literal readings, the forecast over the amounts and the pace it is
 * handed, the caveats over their counts. What no unit test can catch is the assembly reading the wrong
 * column — forecasting from the last stored reading instead of the live burn,
 * or counting the delivered unsized lines instead of the open ones. Both are
 * silent, both are plausible, and both are visible the moment real rows go in
 * at one end and a date comes out of the other.
 */

let db: Database;
let projectId: string;

/** $150.00 an hour on a $5,000.00 contract. */
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
});

/** A day's work, logged and then measured as that day ended. */
async function workAndRecord(onDate: string, minutes: number): Promise<void> {
  await createTimeEntry({ projectId, minutes, workedOn: onDate }, db);
  await captureProjectBurn(projectId, onDate, { today: onDate }, db);
}

/** The projection the overview tab would draw on `today`. */
async function projectionOn(today: string) {
  const [totals, lines, snapshots] = await Promise.all([
    projectTimeTotals(projectId, db),
    listDeliverables(projectId, db),
    listBurnSnapshots(projectId, db),
  ]);
  const project = { rateCents: 15_000 };
  const summary = summariseBurn(
    totals,
    500_000,
    resolveRate(project, { defaultRateCents: 0 }),
  );
  return projectProjection(summary, lines, burnDownReadings(snapshots), today);
}

describe("a project's projection, from the rows", () => {
  it("forecasts an overage from the pace and the unfinished estimates", async () => {
    // Four hours a day for seven days: $4,200.00 burned at $600.00 a day.
    for (const day of [
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]) {
      await workAndRecord(day, 240);
    }
    // Ten hours done, ten still to do: $1,500.00 more at this rate.
    await createDeliverable(
      { projectId, title: "Templates", estimatedMinutes: 600, status: "done" },
      db,
    );
    await createDeliverable(
      { projectId, title: "Migration", estimatedMinutes: 600 },
      db,
    );

    const projection = await projectionOn("2026-10-11");

    expect(projection?.forecast.burnedCents).toBe(420_000);
    expect(projection?.forecast.remainingWorkCents).toBe(150_000);
    expect(projection?.forecast.projectedFinalCents).toBe(570_000);
    expect(projection?.forecast.projectedOverageCents).toBe(70_000);
  });

  it("forecasts from the live burn, not the last stored reading", async () => {
    await workAndRecord("2026-10-05", 240);
    await workAndRecord("2026-10-11", 240);
    // An hour logged since the last reading was stored, the way somebody
    // logging time and then opening the page would leave it.
    await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-12" },
      db,
    );
    await createDeliverable(
      { projectId, title: "Migration", estimatedMinutes: 600 },
      db,
    );

    const projection = await projectionOn("2026-10-12");

    // Nine hours at $150.00, not the eight the last reading recorded.
    expect(projection?.forecast.burnedCents).toBe(135_000);
  });

  it("counts the open unsized lines, not the delivered ones", async () => {
    await workAndRecord("2026-10-05", 240);
    await workAndRecord("2026-10-11", 240);
    await createDeliverable(
      { projectId, title: "Templates", status: "done" },
      db,
    );
    await createDeliverable({ projectId, title: "Migration" }, db);
    await createDeliverable(
      { projectId, title: "Launch", estimatedMinutes: 300 },
      db,
    );

    const projection = await projectionOn("2026-10-11");

    expect(projection?.evidence.unsizedUndeliveredCount).toBe(1);
    expect(projection?.caveats).toContain("unsized-scope");
  });

  it("measures the pace off the days the readings cover", async () => {
    await workAndRecord("2026-10-05", 240);
    await workAndRecord("2026-10-11", 240);
    await createDeliverable(
      { projectId, title: "Migration", estimatedMinutes: 600 },
      db,
    );

    const projection = await projectionOn("2026-10-11");

    // $1,200.00 across the seven days from the fifth to the eleventh.
    expect(projection?.overallPace.elapsedDays).toBe(7);
    expect(projection?.overallPace.burnedCents).toBe(120_000);
    expect(projection?.pace.centsPerDay).toBeCloseTo(120_000 / 7, 6);
  });

  it("caveats a history the page reconstructed rather than measured", async () => {
    // Time logged on days nobody opened the page, then one reading taken
    // today — which is the shape every existing project is in.
    await createTimeEntry(
      { projectId, minutes: 240, workedOn: "2026-10-05" },
      db,
    );
    await createTimeEntry(
      { projectId, minutes: 240, workedOn: "2026-10-08" },
      db,
    );
    // Recorded against a later clock, which is what makes them
    // reconstructions rather than measurements.
    await captureProjectBurn(
      projectId,
      "2026-10-05",
      { today: "2026-10-11" },
      db,
    );
    await captureProjectBurn(
      projectId,
      "2026-10-08",
      { today: "2026-10-11" },
      db,
    );
    await captureProjectBurn(
      projectId,
      "2026-10-11",
      { today: "2026-10-11" },
      db,
    );
    await createDeliverable(
      { projectId, title: "Migration", estimatedMinutes: 600 },
      db,
    );

    const projection = await projectionOn("2026-10-11");

    expect(projection?.caveats).toContain("reconstructed-history");
    expect(projection?.confidence).toBe("indicative");
  });

  it("withholds the cost when the open lines are all unsized", async () => {
    await workAndRecord("2026-10-05", 240);
    await workAndRecord("2026-10-11", 240);
    // Two lines still to do, neither of them sized. The column has no null,
    // so an unsized line is stored as nought minutes.
    await createDeliverable({ projectId, title: "Migration" }, db);
    await createDeliverable({ projectId, title: "Launch" }, db);

    const projection = await projectionOn("2026-10-11");

    expect(projection).not.toBeNull();
    expect(projection?.forecast.remainingWorkCents).toBe(0);
    expect(projection?.caveats).toContain("unvalued-scope");
    expect(projection?.confidence).toBe("weak");
    // The end of the money survives: it needs the pace and the price, and
    // neither of those has an opinion about what the work is.
    expect(projection?.forecast.contractRunsOutOn).not.toBeNull();
  });

  it("has nothing to project for a project nobody has logged against", async () => {
    await createDeliverable(
      { projectId, title: "Migration", estimatedMinutes: 600 },
      db,
    );
    expect(await projectionOn("2026-10-11")).toBeNull();
  });
});
