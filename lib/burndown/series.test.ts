import { describe, expect, it } from "vitest";

import { burnDaysThrough, type BurnDay } from "./series";

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
