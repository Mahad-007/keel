import { describe, expect, it } from "vitest";

import { accumulateBurnDays, burnDaysThrough, type BurnDay } from "./series";

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
