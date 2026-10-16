import { describe, expect, it } from "vitest";

import { formatDate, isCalendarDate } from "./dates";

describe("formatDate", () => {
  it("formats a full ISO timestamp", () => {
    expect(formatDate("2026-09-21T09:36:00.000Z")).toBe("Sep 21, 2026");
  });

  it("formats SQLite's current_timestamp form", () => {
    expect(formatDate("2026-09-21 09:36:00")).toBe("Sep 21, 2026");
  });

  it("formats a bare date", () => {
    expect(formatDate("2026-01-05")).toBe("Jan 5, 2026");
  });

  it("reads the calendar date off the string rather than a local Date", () => {
    // Late-evening UTC: constructing a Date would roll this back a day for
    // anyone west of Greenwich.
    expect(formatDate("2026-03-01T23:59:59.000Z")).toBe("Mar 1, 2026");
  });

  it("ignores surrounding whitespace", () => {
    expect(formatDate("  2026-12-31T00:00:00.000Z  ")).toBe("Dec 31, 2026");
  });

  it("hands back a value with an impossible month unchanged", () => {
    expect(formatDate("2026-13-01")).toBe("2026-13-01");
  });

  it("hands back anything that isn't a date unchanged", () => {
    expect(formatDate("not a date")).toBe("not a date");
    expect(formatDate("")).toBe("");
    expect(formatDate("21/09/2026")).toBe("21/09/2026");
    expect(formatDate("2026-09-2")).toBe("2026-09-2");
  });
});

describe("isCalendarDate", () => {
  it("accepts a plain calendar date", () => {
    expect(isCalendarDate("2026-10-16")).toBe(true);
  });

  it("accepts the ends of a year", () => {
    expect(isCalendarDate("2026-01-01")).toBe(true);
    expect(isCalendarDate("2026-12-31")).toBe(true);
  });

  it("accepts February 29 in a leap year", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });

  it("refuses February 29 in a year that has no such day", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false);
  });

  it("refuses a day past the end of its month", () => {
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
  });

  it("refuses a month that does not exist", () => {
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-00-01")).toBe(false);
  });

  it("refuses a zeroth day", () => {
    expect(isCalendarDate("2026-10-00")).toBe(false);
  });

  it("refuses a timestamp, which is the whole point", () => {
    expect(isCalendarDate("2026-10-16T09:36:00.000Z")).toBe(false);
    expect(isCalendarDate("2026-10-16 09:36:00")).toBe(false);
  });

  it("refuses an unpadded date, so stored dates sort as strings", () => {
    expect(isCalendarDate("2026-1-5")).toBe(false);
  });

  it("refuses surrounding whitespace rather than trimming it", () => {
    // The guard in front of the column trims before asking, so a value that
    // reaches here with spaces on it is not what was stored.
    expect(isCalendarDate(" 2026-10-16 ")).toBe(false);
  });

  it("refuses anything that is not a date at all", () => {
    expect(isCalendarDate("")).toBe(false);
    expect(isCalendarDate("yesterday")).toBe(false);
    expect(isCalendarDate("16/10/2026")).toBe(false);
  });
});
