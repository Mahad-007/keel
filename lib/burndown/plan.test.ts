import { describe, expect, it } from "vitest";

import type { EffectiveRate } from "@/lib/rates";

import { planBurnBackfill, staleBurnPoints, withoutRecordedDays } from "./plan";
import { accumulateBurnDays, burnSeries, type BurnDay } from "./series";

/**
 * The readings a project would hold for the given days, as the table stores
 * them: running totals, not each day's own work.
 */
function recorded(onDates: readonly string[]): BurnDay[] {
  return accumulateBurnDays(DAYS).filter((day) =>
    onDates.includes(day.onDate),
  );
}

const RATE: EffectiveRate = { cents: 15_000, source: "project" };

function day(onDate: string, loggedMinutes = 60): BurnDay {
  return { onDate, entryCount: 1, loggedMinutes, billableMinutes: loggedMinutes };
}

const DAYS = [day("2026-03-01"), day("2026-03-02"), day("2026-03-03")];

describe("withoutRecordedDays", () => {
  it("leaves the days that already have a reading", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const pending = withoutRecordedDays(points, recorded(["2026-03-02"]));
    expect(pending.map((p) => p.onDate)).toEqual(["2026-03-01", "2026-03-03"]);
  });

  it("keeps the running total of the days it dropped", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const pending = withoutRecordedDays(points, recorded(["2026-03-01", "2026-03-02"]));
    // The third of March is three hours in, not one: the two stored days still
    // happened, and a reading that forgot them would restart the engagement.
    expect(pending).toHaveLength(1);
    expect(pending[0].loggedMinutes).toBe(180);
    expect(pending[0].burnedCents).toBe(45_000);
  });

  it("writes nothing when every day is already recorded", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    expect(
      withoutRecordedDays(
        points,
        recorded(["2026-03-01", "2026-03-02", "2026-03-03"]),
      ),
    ).toEqual([]);
  });

  it("ignores a recorded day the project has no work on", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const pending = withoutRecordedDays(points, [{ onDate: "2025-01-01", entryCount: 1, loggedMinutes: 60, billableMinutes: 60 }]);
    expect(pending.map((p) => p.onDate)).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("holds the series in calendar order, oldest first", () => {
    const points = burnSeries([day("2026-03-03"), day("2026-03-01")], 500_000, RATE);
    expect(withoutRecordedDays(points, []).map((p) => p.onDate)).toEqual([
      "2026-03-01",
      "2026-03-03",
    ]);
  });
});

describe("planBurnBackfill", () => {
  it("plans every day of a project nothing has recorded", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });
    expect(plan.points.map((p) => [p.onDate, p.burnedCents])).toEqual([
      ["2026-03-01", 15_000],
      ["2026-03-02", 30_000],
      ["2026-03-03", 45_000],
    ]);
    expect(plan.alreadyRecorded).toBe(0);
  });

  it("plans nothing on a second run, and says what it left", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: recorded(["2026-03-01", "2026-03-02", "2026-03-03"]),
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });
    expect(plan.points).toEqual([]);
    expect(plan.alreadyRecorded).toBe(3);
  });

  it("fills a gap in the middle without disturbing its neighbours", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: recorded(["2026-03-01", "2026-03-03"]),
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });
    expect(plan.points.map((p) => [p.onDate, p.loggedMinutes])).toEqual([
      ["2026-03-02", 120],
    ]);
    expect(plan.alreadyRecorded).toBe(2);
  });

  it("stops at the day it is run on, with the total it had reached", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-02",
    });
    expect(plan.points.map((p) => [p.onDate, p.loggedMinutes])).toEqual([
      ["2026-03-01", 60],
      ["2026-03-02", 120],
    ]);
  });

  it("does not count a recorded day the project never worked", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [
        {
          onDate: "2026-02-14",
          entryCount: 1,
          loggedMinutes: 60,
          billableMinutes: 60,
        },
        ...recorded(["2026-03-02"]),
      ],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });
    expect(plan.alreadyRecorded).toBe(1);
    expect(plan.points).toHaveLength(2);
  });

  it("does not count a day beyond the bound as recorded or pending", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: recorded(["2026-03-03"]),
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-01",
    });
    expect(plan.points.map((p) => p.onDate)).toEqual(["2026-03-01"]);
    expect(plan.alreadyRecorded).toBe(0);
  });

  it("plans nothing for a project with no time logged", () => {
    const plan = planBurnBackfill({
      days: [],
      recorded: [],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });
    expect(plan).toEqual({ points: [], stale: [], alreadyRecorded: 0 });
  });

  it("values the past at today's rate, which is all it can know", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [],
      contractedCents: 500_000,
      rate: { cents: 20_000, source: "client" },
      through: "2026-03-31",
    });
    expect(plan.points.map((p) => p.rate.source)).toEqual([
      "client",
      "client",
      "client",
    ]);
    expect(plan.points[2].burnedCents).toBe(60_000);
  });
});

describe("staleBurnPoints", () => {
  it("is empty when every reading still agrees with the entries", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    expect(
      staleBurnPoints(points, recorded(["2026-03-01", "2026-03-02"])),
    ).toEqual([]);
  });

  it("is empty for a day with no reading at all", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    expect(staleBurnPoints(points, [])).toEqual([]);
  });

  it("finds a day whose minutes have moved since it was read", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const stale = staleBurnPoints(points, [
      { onDate: "2026-03-02", entryCount: 2, loggedMinutes: 60, billableMinutes: 60 },
    ]);

    expect(stale.map((point) => point.onDate)).toEqual(["2026-03-02"]);
    expect(stale[0].loggedMinutes).toBe(120);
  });

  it("finds a day whose entry count has moved but whose minutes have not", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const stale = staleBurnPoints(points, [
      { onDate: "2026-03-02", entryCount: 1, loggedMinutes: 120, billableMinutes: 120 },
    ]);

    expect(stale.map((point) => point.onDate)).toEqual(["2026-03-02"]);
  });

  it("finds a day whose chargeable half has moved", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const stale = staleBurnPoints(points, [
      { onDate: "2026-03-02", entryCount: 2, loggedMinutes: 120, billableMinutes: 60 },
    ]);

    expect(stale.map((point) => point.onDate)).toEqual(["2026-03-02"]);
  });

  it("does not call a reading stale over money alone", () => {
    // The same work valued at a rate that has since doubled: the whole reason
    // the figures are stored rather than recomputed.
    const points = burnSeries(DAYS, 500_000, { cents: 30_000, source: "project" });
    expect(
      staleBurnPoints(points, recorded(["2026-03-01", "2026-03-02", "2026-03-03"])),
    ).toEqual([]);
  });

  it("holds the stale days in calendar order", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const stale = staleBurnPoints(points, [
      { onDate: "2026-03-03", entryCount: 1, loggedMinutes: 60, billableMinutes: 60 },
      { onDate: "2026-03-01", entryCount: 1, loggedMinutes: 30, billableMinutes: 30 },
    ]);

    expect(stale.map((point) => point.onDate)).toEqual([
      "2026-03-01",
      "2026-03-03",
    ]);
  });
});

describe("planBurnBackfill over a day whose time was logged late", () => {
  it("plans a repair rather than leaving the reading as it is", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [
        { onDate: "2026-03-01", entryCount: 1, loggedMinutes: 30, billableMinutes: 30 },
      ],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });

    expect(plan.stale.map((point) => point.onDate)).toEqual(["2026-03-01"]);
    expect(plan.stale[0].loggedMinutes).toBe(60);
    expect(plan.alreadyRecorded).toBe(0);
  });

  it("keeps the repair out of the days it has nothing for", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [
        { onDate: "2026-03-01", entryCount: 1, loggedMinutes: 30, billableMinutes: 30 },
      ],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });

    expect(plan.points.map((point) => point.onDate)).toEqual([
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("counts a day it leaves alone separately from one it repairs", () => {
    const plan = planBurnBackfill({
      days: DAYS,
      recorded: [
        ...recorded(["2026-03-01"]),
        { onDate: "2026-03-02", entryCount: 1, loggedMinutes: 60, billableMinutes: 60 },
      ],
      contractedCents: 500_000,
      rate: RATE,
      through: "2026-03-31",
    });

    expect(plan.alreadyRecorded).toBe(1);
    expect(plan.stale.map((point) => point.onDate)).toEqual(["2026-03-02"]);
    expect(plan.points.map((point) => point.onDate)).toEqual(["2026-03-03"]);
  });
});
