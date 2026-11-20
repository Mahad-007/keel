import { describe, expect, it } from "vitest";

import type { EffectiveRate } from "@/lib/rates";

import {
  accumulateBurnDays,
  burnDaysThrough,
  burnSeries,
  recordedBurnPoint,
  type BurnDay,
  type RecordedBurn,
} from "./series";

/** A day of logged work, with the figures a caller does not care about filled. */
function day(onDate: string, loggedMinutes = 60): BurnDay {
  return { onDate, entryCount: 1, loggedMinutes, billableMinutes: loggedMinutes };
}

describe("burnDaysThrough", () => {
  it("keeps the bound itself, because a day is a whole day", () => {
    const days = [day("2026-03-01"), day("2026-03-02")];
    expect(burnDaysThrough(days, "2026-03-02").map((d) => d.onDate)).toEqual([
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("drops work logged against a day that has not happened", () => {
    const days = [day("2026-03-01"), day("2026-03-09")];
    expect(burnDaysThrough(days, "2026-03-02").map((d) => d.onDate)).toEqual([
      "2026-03-01",
    ]);
  });

  it("keeps the order it was given rather than sorting", () => {
    const days = [day("2026-03-09"), day("2026-03-01"), day("2026-03-05")];
    expect(burnDaysThrough(days, "2026-12-31").map((d) => d.onDate)).toEqual([
      "2026-03-09",
      "2026-03-01",
      "2026-03-05",
    ]);
  });

  it("compares across months and years, not just digits", () => {
    const days = [day("2025-12-31"), day("2026-01-01"), day("2026-02-01")];
    expect(burnDaysThrough(days, "2026-01-01").map((d) => d.onDate)).toEqual([
      "2025-12-31",
      "2026-01-01",
    ]);
  });

  it("drops a day that is not a calendar date, which cannot be plotted", () => {
    const days = [day("2026-03-01"), day("2026-03-01T09:00:00.000Z"), day("")];
    expect(burnDaysThrough(days, "2026-12-31").map((d) => d.onDate)).toEqual([
      "2026-03-01",
    ]);
  });

  it("holds an empty series empty", () => {
    expect(burnDaysThrough([], "2026-03-02")).toEqual([]);
  });

  it("refuses a bound that is not a calendar date", () => {
    expect(() => burnDaysThrough([], "2026-03-02T09:00:00.000Z")).toThrow(
      "not a calendar date",
    );
    expect(() => burnDaysThrough([], "2026-02-30")).toThrow(
      "not a calendar date",
    );
  });
});

describe("accumulateBurnDays", () => {
  it("carries each day's total forward into the next", () => {
    const series = accumulateBurnDays([
      day("2026-03-01", 60),
      day("2026-03-02", 90),
      day("2026-03-04", 30),
    ]);
    expect(series.map((d) => [d.onDate, d.loggedMinutes])).toEqual([
      ["2026-03-01", 60],
      ["2026-03-02", 150],
      ["2026-03-04", 180],
    ]);
  });

  it("accumulates in calendar order whatever order it was given", () => {
    const series = accumulateBurnDays([
      day("2026-03-04", 30),
      day("2026-03-01", 60),
      day("2026-03-02", 90),
    ]);
    expect(series.map((d) => [d.onDate, d.loggedMinutes])).toEqual([
      ["2026-03-01", 60],
      ["2026-03-02", 150],
      ["2026-03-04", 180],
    ]);
  });

  it("counts the entries behind the figure as well as the minutes", () => {
    const series = accumulateBurnDays([
      { onDate: "2026-03-01", entryCount: 2, loggedMinutes: 60, billableMinutes: 60 },
      { onDate: "2026-03-02", entryCount: 3, loggedMinutes: 90, billableMinutes: 30 },
    ]);
    expect(series.map((d) => d.entryCount)).toEqual([2, 5]);
  });

  it("keeps the chargeable half running separately", () => {
    const series = accumulateBurnDays([
      { onDate: "2026-03-01", entryCount: 1, loggedMinutes: 60, billableMinutes: 0 },
      { onDate: "2026-03-02", entryCount: 1, loggedMinutes: 60, billableMinutes: 60 },
    ]);
    expect(series.map((d) => [d.loggedMinutes, d.billableMinutes])).toEqual([
      [60, 0],
      [120, 60],
    ]);
  });

  it("combines two helpings of one day into a single point", () => {
    const series = accumulateBurnDays([
      day("2026-03-01", 60),
      day("2026-03-01", 30),
      day("2026-03-02", 15),
    ]);
    expect(series.map((d) => [d.onDate, d.loggedMinutes, d.entryCount])).toEqual([
      ["2026-03-01", 90, 2],
      ["2026-03-02", 105, 3],
    ]);
  });

  it("has no point at all for a project with no time logged", () => {
    expect(accumulateBurnDays([])).toEqual([]);
  });

  it("does not mutate the days it was handed", () => {
    const days = [day("2026-03-02", 90), day("2026-03-01", 60)];
    accumulateBurnDays(days);
    expect(days.map((d) => [d.onDate, d.loggedMinutes])).toEqual([
      ["2026-03-02", 90],
      ["2026-03-01", 60],
    ]);
  });
});

/** $150 an hour, set on the project itself. */
const RATE: EffectiveRate = { cents: 15_000, source: "project" };

describe("burnSeries", () => {
  it("values the running minutes of each day at the rate", () => {
    const series = burnSeries(
      [day("2026-03-01", 60), day("2026-03-02", 30)],
      500_000,
      RATE,
    );
    expect(series.map((p) => [p.onDate, p.burnedCents])).toEqual([
      ["2026-03-01", 15_000],
      ["2026-03-02", 22_500],
    ]);
  });

  it("sets each day's burn against the contract it was sold for", () => {
    const series = burnSeries([day("2026-03-01", 60)], 500_000, RATE);
    expect(series[0].contractedCents).toBe(500_000);
    expect(series[0].remainingCents).toBe(485_000);
    expect(series[0].consumedShare).toBeCloseTo(0.03);
  });

  it("carries the rate onto every point, so a zero can be explained", () => {
    const series = burnSeries([day("2026-03-01", 60)], 500_000, {
      cents: 0,
      source: "none",
    });
    expect(series[0].burnedCents).toBe(0);
    expect(series[0].rate.source).toBe("none");
  });

  it("crosses the contract and keeps going, which is the point of it", () => {
    const series = burnSeries(
      [day("2026-03-01", 60 * 30), day("2026-03-02", 60 * 10)],
      300_000,
      RATE,
    );
    expect(series.map((p) => p.remainingCents)).toEqual([-150_000, -300_000]);
    expect(series[1].consumedShare).toBeCloseTo(2);
  });

  it("values the total rather than each day, so the cents do not drift", () => {
    const twentyMinuteDays = [
      day("2026-03-01", 20),
      day("2026-03-02", 20),
      day("2026-03-03", 20),
    ];
    const series = burnSeries(twentyMinuteDays, 500_000, RATE);
    // Three days of twenty minutes is an hour, so the last point is the rate
    // exactly — where valuing each day separately gives 5000 x 3 - 1 cent.
    expect(series[2].burnedCents).toBe(15_000);
  });

  it("keeps the chargeable figure beside the burn", () => {
    const series = burnSeries(
      [
        { onDate: "2026-03-01", entryCount: 1, loggedMinutes: 60, billableMinutes: 0 },
        { onDate: "2026-03-02", entryCount: 1, loggedMinutes: 60, billableMinutes: 60 },
      ],
      500_000,
      RATE,
    );
    expect(series.map((p) => [p.burnedCents, p.chargeableCents])).toEqual([
      [15_000, 0],
      [30_000, 15_000],
    ]);
  });

  it("has no points for a project with no time logged", () => {
    expect(burnSeries([], 500_000, RATE)).toEqual([]);
  });
});

/** A stored reading of one day: ten hours of a $500,000 contract at $150. */
const RECORDED: RecordedBurn = {
  onDate: "2026-03-02",
  contractValueCents: 500_000,
  rateCents: 15_000,
  rateSource: "project",
  entryCount: 4,
  loggedMinutes: 600,
  billableMinutes: 540,
  burnedCents: 150_000,
  chargeableCents: 135_000,
};

describe("recordedBurnPoint", () => {
  it("reports the money the row holds rather than recomputing it", () => {
    const point = recordedBurnPoint({ ...RECORDED, rateCents: 1 });
    expect(point.burnedCents).toBe(150_000);
    expect(point.rate.cents).toBe(1);
  });

  it("keeps the day, the minutes and the entries behind the figure", () => {
    const point = recordedBurnPoint(RECORDED);
    expect(point.onDate).toBe("2026-03-02");
    expect(point.loggedMinutes).toBe(600);
    expect(point.billableMinutes).toBe(540);
    expect(point.entryCount).toBe(4);
    expect(point.chargeableCents).toBe(135_000);
  });

  it("measures against the price the day was measured against", () => {
    const point = recordedBurnPoint(RECORDED);
    expect(point.contractedCents).toBe(500_000);
    expect(point.remainingCents).toBe(350_000);
    expect(point.consumedShare).toBeCloseTo(0.3);
  });

  it("carries the rate's provenance, so a zero can be read", () => {
    const point = recordedBurnPoint({
      ...RECORDED,
      rateCents: 0,
      rateSource: "none",
      burnedCents: 0,
      chargeableCents: 0,
    });
    expect(point.rate).toEqual({ cents: 0, source: "none" });
    expect(point.burnedCents).toBe(0);
  });

  it("reports a day that had gone over as having gone over", () => {
    const point = recordedBurnPoint({ ...RECORDED, burnedCents: 650_000 });
    expect(point.remainingCents).toBe(-150_000);
    expect(point.consumedShare).toBeCloseTo(1.3);
  });

  it("has no share to report when the day had no price", () => {
    const point = recordedBurnPoint({ ...RECORDED, contractValueCents: 0 });
    expect(point.consumedShare).toBeNull();
    expect(point.remainingCents).toBe(-150_000);
  });

  it("agrees with the live series over the same day", () => {
    const [live] = burnSeries([day("2026-03-02", 600)], 500_000, RATE);
    const stored = recordedBurnPoint({ ...RECORDED, entryCount: 1, billableMinutes: 600, chargeableCents: 150_000 });
    expect(stored).toEqual(live);
  });
});
