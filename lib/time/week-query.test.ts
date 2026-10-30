import { describe, expect, it } from "vitest";

import {
  isCurrentWeek,
  parseTimesheetWeek,
  parseWeekParam,
  timesheetHref,
  TIMESHEET_PATH,
  WEEK_PARAM,
} from "./week-query";
import { nextWeek, previousWeek, weekOf } from "./week";

const TODAY = "2026-10-29";

describe("parseWeekParam", () => {
  it("shows the week today is in when nothing is asked for", () => {
    expect(parseWeekParam(undefined, TODAY)).toEqual(weekOf(TODAY));
  });

  it("shows the week a start day names", () => {
    expect(parseWeekParam("2026-10-19", TODAY).start).toBe("2026-10-19");
  });

  it("shows the week any other day of it names", () => {
    expect(parseWeekParam("2026-10-22", TODAY).start).toBe("2026-10-19");
  });

  it("falls back to this week for a value that is not a date", () => {
    expect(parseWeekParam("last", TODAY)).toEqual(weekOf(TODAY));
    expect(parseWeekParam("", TODAY)).toEqual(weekOf(TODAY));
  });

  it("falls back to this week for a day that does not exist", () => {
    expect(parseWeekParam("2026-02-30", TODAY)).toEqual(weekOf(TODAY));
  });

  it("falls back for a day whose week would run off the calendar", () => {
    expect(parseWeekParam("0000-01-01", TODAY)).toEqual(weekOf(TODAY));
    expect(parseWeekParam("9999-12-31", TODAY)).toEqual(weekOf(TODAY));
  });

  it("falls back rather than hand back a week with no week beside it", () => {
    // The page it lands on links to the week either side, so a week whose
    // neighbours are off the calendar has to fall back here as well.
    for (const edge of ["0000-01-07", "9999-12-25"]) {
      const week = parseWeekParam(edge, TODAY);
      expect(week).toEqual(weekOf(TODAY));
      expect(() => previousWeek(week)).not.toThrow();
      expect(() => nextWeek(week)).not.toThrow();
    }
  });

  it("falls back to this week for a timestamp", () => {
    expect(parseWeekParam("2026-10-19T00:00:00.000Z", TODAY)).toEqual(
      weekOf(TODAY),
    );
  });
});

describe("parseTimesheetWeek", () => {
  it("reads the week off the params", () => {
    expect(parseTimesheetWeek({ [WEEK_PARAM]: "2026-10-19" }, TODAY).start).toBe(
      "2026-10-19",
    );
  });

  it("ignores params it does not know", () => {
    expect(parseTimesheetWeek({ project: "abc" }, TODAY)).toEqual(
      weekOf(TODAY),
    );
  });

  it("honours the first of a repeated param", () => {
    expect(
      parseTimesheetWeek(
        { [WEEK_PARAM]: ["2026-10-19", "2026-09-07"] },
        TODAY,
      ).start,
    ).toBe("2026-10-19");
  });
});

describe("timesheetHref", () => {
  it("names the week by its start day", () => {
    expect(timesheetHref(weekOf("2026-10-29"))).toBe(
      `${TIMESHEET_PATH}?${WEEK_PARAM}=2026-10-26`,
    );
  });

  it("round-trips through the parser", () => {
    const week = weekOf("2026-03-04");
    const href = timesheetHref(week);
    const asked = new URL(href, "https://example.test").searchParams.get(
      WEEK_PARAM,
    );
    expect(parseWeekParam(asked ?? undefined, TODAY)).toEqual(week);
  });

  it("names this week explicitly rather than leaving the param off", () => {
    expect(timesheetHref(weekOf(TODAY))).toContain(WEEK_PARAM);
  });
});

describe("isCurrentWeek", () => {
  it("is true for the week today falls in", () => {
    expect(isCurrentWeek(weekOf(TODAY), TODAY)).toBe(true);
  });

  it("is true however that week was asked for", () => {
    expect(isCurrentWeek(weekOf("2026-10-26"), TODAY)).toBe(true);
    expect(isCurrentWeek(weekOf("2026-11-01"), TODAY)).toBe(true);
  });

  it("is false for the weeks either side", () => {
    expect(isCurrentWeek(weekOf("2026-10-19"), TODAY)).toBe(false);
    expect(isCurrentWeek(weekOf("2026-11-02"), TODAY)).toBe(false);
  });
});
