import { describe, expect, it } from "vitest";

import { weekdayIndex, weekdayName } from "./week";

describe("weekdayIndex", () => {
  it("puts the week's start day in the first column", () => {
    // 2026-10-26 is a Monday.
    expect(weekdayIndex("2026-10-26")).toBe(0);
  });

  it("counts through the week to the day before the next one", () => {
    expect(weekdayIndex("2026-10-27")).toBe(1);
    expect(weekdayIndex("2026-10-28")).toBe(2);
    expect(weekdayIndex("2026-10-29")).toBe(3);
    expect(weekdayIndex("2026-10-30")).toBe(4);
    expect(weekdayIndex("2026-10-31")).toBe(5);
    expect(weekdayIndex("2026-11-01")).toBe(6);
  });

  it("starts a new week on the following start day", () => {
    expect(weekdayIndex("2026-11-02")).toBe(0);
  });

  it("reads the day in UTC rather than the server's timezone", () => {
    // Midnight UTC on a Monday is Sunday evening in New York. Reading the date
    // locally would file it in the last column of the week before.
    expect(weekdayIndex("2026-10-26")).toBe(0);
    expect(weekdayIndex("2026-01-01")).toBe(3);
  });

  it("refuses a timestamp", () => {
    expect(() => weekdayIndex("2026-10-26T09:00:00.000Z")).toThrow(
      /not a calendar date/,
    );
  });
});

describe("weekdayName", () => {
  it("names each day of one week", () => {
    expect(weekdayName("2026-10-26")).toBe("Mon");
    expect(weekdayName("2026-10-27")).toBe("Tue");
    expect(weekdayName("2026-10-28")).toBe("Wed");
    expect(weekdayName("2026-10-29")).toBe("Thu");
    expect(weekdayName("2026-10-30")).toBe("Fri");
    expect(weekdayName("2026-10-31")).toBe("Sat");
    expect(weekdayName("2026-11-01")).toBe("Sun");
  });

  it("refuses a day that does not exist", () => {
    expect(() => weekdayName("2026-02-30")).toThrow(/not a calendar date/);
  });
});
