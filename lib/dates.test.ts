import { describe, expect, it } from "vitest";

import {
  calendarDateParts,
  formatDate,
  formatYear,
  isCalendarDate,
  localCalendarDate,
  shiftCalendarDate,
  utcCalendarDate,
} from "./dates";

describe("calendarDateParts", () => {
  it("names the month and numbers the day and year", () => {
    expect(calendarDateParts("2026-09-21")).toEqual({
      year: 2026,
      month: "Sep",
      day: 21,
    });
  });

  it("reads the date off the front of a timestamp", () => {
    expect(calendarDateParts("2026-01-05T09:36:00.000Z")).toEqual({
      year: 2026,
      month: "Jan",
      day: 5,
    });
    expect(calendarDateParts("2026-12-31 23:00:00")).toEqual({
      year: 2026,
      month: "Dec",
      day: 31,
    });
  });

  it("strips the leading zero off a day so it can be compared", () => {
    const parts = calendarDateParts("2026-03-08");
    expect(parts?.day).toBe(8);
  });

  it("refuses a month no name belongs to", () => {
    expect(calendarDateParts("2026-00-01")).toBeNull();
    expect(calendarDateParts("2026-13-01")).toBeNull();
  });

  it("refuses anything that does not start with a date", () => {
    expect(calendarDateParts("")).toBeNull();
    expect(calendarDateParts("not a date")).toBeNull();
    expect(calendarDateParts("21/09/2026")).toBeNull();
    expect(calendarDateParts("2026-09-2")).toBeNull();
  });
});

describe("formatYear", () => {
  it("leaves a four-digit year alone", () => {
    expect(formatYear(2026)).toBe("2026");
  });

  it("pads the years a calendar date can hold but a number cannot write", () => {
    expect(formatYear(99)).toBe("0099");
    expect(formatYear(1)).toBe("0001");
    expect(formatYear(0)).toBe("0000");
  });
});

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

  it("keeps the leading zeros of a year that has them", () => {
    // The number the parts hold has none, so the label has to put them back:
    // `0099` is not `99` and `0000` is not `0`.
    expect(formatDate("0099-03-04")).toBe("Mar 4, 0099");
    expect(formatDate("0000-01-10")).toBe("Jan 10, 0000");
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

describe("localCalendarDate", () => {
  it("reads the local day off a moment", () => {
    // Constructed from local components, so the assertion holds wherever the
    // test runs: the point of the function is that it never consults UTC.
    expect(localCalendarDate(new Date(2026, 9, 17, 9, 36))).toBe("2026-10-17");
  });

  it("pads a single-digit month and day", () => {
    // Unpadded, `isCalendarDate` refuses the value and the column with it.
    expect(localCalendarDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("produces a value the calendar-date guard accepts", () => {
    expect(isCalendarDate(localCalendarDate(new Date(2026, 1, 28)))).toBe(true);
    expect(isCalendarDate(localCalendarDate(new Date(2024, 1, 29)))).toBe(true);
  });

  it("stays on the local day at either end of it", () => {
    // The two moments a UTC reading gets wrong for somebody east or west of
    // it: a minute into the day and a minute before it ends.
    expect(localCalendarDate(new Date(2026, 9, 17, 0, 1))).toBe("2026-10-17");
    expect(localCalendarDate(new Date(2026, 9, 17, 23, 59))).toBe("2026-10-17");
  });

  it("rolls over at midnight rather than at noon", () => {
    expect(localCalendarDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(localCalendarDate(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });
});

describe("shiftCalendarDate", () => {
  it("moves forward and back within a month", () => {
    expect(shiftCalendarDate("2026-10-14", 1)).toBe("2026-10-15");
    expect(shiftCalendarDate("2026-10-14", -1)).toBe("2026-10-13");
  });

  it("rolls over the end of a month", () => {
    expect(shiftCalendarDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftCalendarDate("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("rolls over the end of a year", () => {
    expect(shiftCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarDate("2027-01-01", -7)).toBe("2026-12-25");
  });

  it("knows February's length in a leap year and out of one", () => {
    expect(shiftCalendarDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftCalendarDate("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("stays on the same day for a shift of nothing", () => {
    expect(shiftCalendarDate("2026-10-14", 0)).toBe("2026-10-14");
  });

  it("crosses a spring-forward boundary one day at a time", () => {
    // The clocks go forward in most of Europe on 2026-03-29. A date has no
    // hour to lose, so the day after it is simply the next one.
    expect(shiftCalendarDate("2026-03-28", 1)).toBe("2026-03-29");
    expect(shiftCalendarDate("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("refuses a timestamp, which is a moment rather than a day", () => {
    expect(() => shiftCalendarDate("2026-10-14T09:00:00.000Z", 1)).toThrow(
      /not a calendar date/,
    );
  });

  it("refuses a day that does not exist", () => {
    expect(() => shiftCalendarDate("2026-02-30", 1)).toThrow(
      /not a calendar date/,
    );
  });

  it("reaches both ends of the years a calendar date can hold", () => {
    expect(shiftCalendarDate("0000-01-07", -6)).toBe("0000-01-01");
    expect(shiftCalendarDate("9999-12-25", 6)).toBe("9999-12-31");
  });

  it("refuses a shift off the end of those years", () => {
    // `toISOString` would write these as `+010000-01-01` and `-000001-12-31`,
    // neither of which is a calendar date — so they fail here rather than
    // somewhere further along with no sign of where they came from.
    expect(() => shiftCalendarDate("9999-12-31", 1)).toThrow(/out of range/);
    expect(() => shiftCalendarDate("0000-01-01", -1)).toThrow(/out of range/);
  });

  it("pads a year that needs it rather than writing it short", () => {
    expect(shiftCalendarDate("0001-01-02", -1)).toBe("0001-01-01");
    expect(shiftCalendarDate("0099-12-31", 1)).toBe("0100-01-01");
  });

  it("refuses a shift so large the arithmetic gives up entirely", () => {
    // Past the days a `Date` can hold, every reading of it is `NaN` — which is
    // neither below zero nor above 9999, so a guard asked the other way round
    // let this through as the string `0NaN-NaN-NaN`.
    expect(() => shiftCalendarDate("2026-10-14", 1e15)).toThrow(
      /out of range/,
    );
    expect(() => shiftCalendarDate("2026-10-14", -1e15)).toThrow(
      /out of range/,
    );
  });

  it("refuses a fractional shift", () => {
    expect(() => shiftCalendarDate("2026-10-14", 1.5)).toThrow(
      /not a whole number of days/,
    );
  });
});

describe("utcCalendarDate", () => {
  it("reads the day off a moment in UTC", () => {
    expect(utcCalendarDate(new Date("2026-10-29T09:36:00.000Z"))).toBe(
      "2026-10-29",
    );
  });

  it("keeps the UTC day at either end of it", () => {
    expect(utcCalendarDate(new Date("2026-10-29T00:00:00.000Z"))).toBe(
      "2026-10-29",
    );
    expect(utcCalendarDate(new Date("2026-10-29T23:59:59.999Z"))).toBe(
      "2026-10-29",
    );
  });

  it("rolls to the next day at midnight UTC rather than locally", () => {
    expect(utcCalendarDate(new Date("2026-10-30T00:00:00.000Z"))).toBe(
      "2026-10-30",
    );
  });

  it("produces something isCalendarDate accepts", () => {
    expect(isCalendarDate(utcCalendarDate(new Date("2026-01-05T12:00:00Z")))).toBe(
      true,
    );
  });
});
