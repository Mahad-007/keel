import { describe, expect, it } from "vitest";

import {
  DAYS_PER_WEEK,
  describeWeek,
  isInWeek,
  isWeekend,
  nextWeek,
  previousWeek,
  shiftWeek,
  startOfWeek,
  weekdayIndex,
  weekdayName,
  weekOf,
} from "./week";

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

describe("startOfWeek", () => {
  it("walks back to the Monday of a midweek date", () => {
    expect(startOfWeek("2026-10-29")).toBe("2026-10-26");
  });

  it("leaves a start day where it is", () => {
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
  });

  it("keeps the Sunday at the end of its week rather than the start of the next", () => {
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
  });

  it("agrees for every day of the same week", () => {
    const week = [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ];
    expect(new Set(week.map(startOfWeek))).toEqual(new Set(["2026-10-26"]));
  });

  it("crosses back over the end of a month", () => {
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02");
    expect(startOfWeek("2026-03-01")).toBe("2026-02-23");
  });

  it("crosses back over the end of a year", () => {
    expect(startOfWeek("2027-01-01")).toBe("2026-12-28");
  });

  it("is idempotent", () => {
    expect(startOfWeek(startOfWeek("2026-10-29"))).toBe("2026-10-26");
  });
});

describe("weekOf", () => {
  it("holds seven days, earliest first", () => {
    expect(weekOf("2026-10-29").days).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("names its own ends", () => {
    const week = weekOf("2026-10-29");
    expect(week.start).toBe("2026-10-26");
    expect(week.end).toBe("2026-11-01");
  });

  it("keeps the ends and the days in step", () => {
    const week = weekOf("2026-10-29");
    expect(week.days).toHaveLength(DAYS_PER_WEEK);
    expect(week.days[0]).toBe(week.start);
    expect(week.days[DAYS_PER_WEEK - 1]).toBe(week.end);
  });

  it("builds the same week from any day in it", () => {
    const monday = weekOf("2026-10-26");
    for (const day of monday.days) {
      expect(weekOf(day)).toEqual(monday);
    }
  });

  it("spans a month boundary without a gap", () => {
    expect(weekOf("2026-03-31").days).toEqual([
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ]);
  });

  it("spans a year boundary without a gap", () => {
    const week = weekOf("2026-12-31");
    expect(week.start).toBe("2026-12-28");
    expect(week.end).toBe("2027-01-03");
  });

  it("refuses a date it cannot place", () => {
    expect(() => weekOf("next Tuesday")).toThrow(/not a calendar date/);
  });
});

describe("shiftWeek", () => {
  it("steps back a week", () => {
    expect(previousWeek(weekOf("2026-10-26")).start).toBe("2026-10-19");
  });

  it("steps forward a week", () => {
    expect(nextWeek(weekOf("2026-10-26")).start).toBe("2026-11-02");
  });

  it("stays put for a shift of nothing", () => {
    const week = weekOf("2026-10-26");
    expect(shiftWeek(week, 0)).toEqual(week);
  });

  it("comes back to where it started", () => {
    const week = weekOf("2026-10-29");
    let walked = week;
    for (let step = 0; step < 9; step += 1) walked = previousWeek(walked);
    for (let step = 0; step < 9; step += 1) walked = nextWeek(walked);
    expect(walked).toEqual(week);
  });

  it("steps over a year boundary", () => {
    expect(nextWeek(weekOf("2026-12-28")).start).toBe("2027-01-04");
    expect(previousWeek(weekOf("2027-01-04")).start).toBe("2026-12-28");
  });

  it("always lands on a week weekOf could have built", () => {
    const stepped = shiftWeek(weekOf("2026-10-29"), -13);
    expect(weekOf(stepped.start)).toEqual(stepped);
  });
});

describe("isInWeek", () => {
  const week = weekOf("2026-10-26");

  it("includes every day of the week", () => {
    for (const day of week.days) expect(isInWeek(week, day)).toBe(true);
  });

  it("includes both ends", () => {
    expect(isInWeek(week, week.start)).toBe(true);
    expect(isInWeek(week, week.end)).toBe(true);
  });

  it("excludes the day either side", () => {
    expect(isInWeek(week, "2026-10-25")).toBe(false);
    expect(isInWeek(week, "2026-11-02")).toBe(false);
  });

  it("excludes a day in another year", () => {
    expect(isInWeek(week, "2025-10-28")).toBe(false);
    expect(isInWeek(week, "2027-10-28")).toBe(false);
  });

  it("leaves a value that is not a date outside every week", () => {
    expect(isInWeek(week, "")).toBe(false);
    expect(isInWeek(week, "sometime")).toBe(false);
  });
});

describe("isWeekend", () => {
  it("counts Saturday and Sunday", () => {
    expect(isWeekend("2026-10-31")).toBe(true);
    expect(isWeekend("2026-11-01")).toBe(true);
  });

  it("does not count the five days between them", () => {
    expect(isWeekend("2026-10-26")).toBe(false);
    expect(isWeekend("2026-10-27")).toBe(false);
    expect(isWeekend("2026-10-28")).toBe(false);
    expect(isWeekend("2026-10-29")).toBe(false);
    expect(isWeekend("2026-10-30")).toBe(false);
  });

  it("marks exactly two of a week's seven days", () => {
    expect(weekOf("2026-10-26").days.filter(isWeekend)).toEqual([
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});

describe("describeWeek", () => {
  it("says the month once when the week sits inside one", () => {
    expect(describeWeek(weekOf("2026-10-07"))).toBe("Oct 5 – 11, 2026");
  });

  it("names both months when the week straddles them", () => {
    expect(describeWeek(weekOf("2026-10-29"))).toBe("Oct 26 – Nov 1, 2026");
  });

  it("spells both years out when the week straddles New Year", () => {
    expect(describeWeek(weekOf("2026-12-31"))).toBe(
      "Dec 28, 2026 – Jan 3, 2027",
    );
  });

  it("says the year once for a week inside one", () => {
    expect(describeWeek(weekOf("2026-02-25"))).toBe("Feb 23 – Mar 1, 2026");
  });

  it("falls back to the raw ends of a week it cannot read", () => {
    expect(
      describeWeek({ start: "soon", end: "later", days: [] }),
    ).toBe("soon – later");
  });
});
