import { describe, expect, it } from "vitest";

import type { EffectiveRate } from "@/lib/rates";

import { withoutRecordedDays } from "./plan";
import { burnSeries, type BurnDay } from "./series";

const RATE: EffectiveRate = { cents: 15_000, source: "project" };

function day(onDate: string, loggedMinutes = 60): BurnDay {
  return { onDate, entryCount: 1, loggedMinutes, billableMinutes: loggedMinutes };
}

const DAYS = [day("2026-03-01"), day("2026-03-02"), day("2026-03-03")];

describe("withoutRecordedDays", () => {
  it("leaves the days that already have a reading", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const pending = withoutRecordedDays(points, ["2026-03-02"]);
    expect(pending.map((p) => p.onDate)).toEqual(["2026-03-01", "2026-03-03"]);
  });

  it("keeps the running total of the days it dropped", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const pending = withoutRecordedDays(points, ["2026-03-01", "2026-03-02"]);
    // The third of March is three hours in, not one: the two stored days still
    // happened, and a reading that forgot them would restart the engagement.
    expect(pending).toHaveLength(1);
    expect(pending[0].loggedMinutes).toBe(180);
    expect(pending[0].burnedCents).toBe(45_000);
  });

  it("writes nothing when every day is already recorded", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    expect(
      withoutRecordedDays(points, ["2026-03-01", "2026-03-02", "2026-03-03"]),
    ).toEqual([]);
  });

  it("ignores a recorded day the project has no work on", () => {
    const points = burnSeries(DAYS, 500_000, RATE);
    const pending = withoutRecordedDays(points, ["2025-01-01"]);
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
