import { describe, expect, it } from "vitest";

import {
  billableMinutes,
  dayQualifiers,
  describeDay,
  describeDayTotal,
  describeTimeList,
  groupTimeByDay,
  showsRunningTotal,
  totalMinutes,
  type LoggedEntry,
  type TimeDay,
} from "./days";

function entry(fields: Partial<LoggedEntry> = {}): LoggedEntry {
  return {
    id: "tme_1",
    minutes: 30,
    workedOn: "2026-10-17",
    billable: true,
    ...fields,
  };
}

describe("what a set of entries comes to", () => {
  it("adds the minutes up", () => {
    expect(totalMinutes([entry({ minutes: 90 }), entry({ minutes: 45 })])).toBe(
      135,
    );
  });

  it("comes to nothing for no entries at all", () => {
    expect(totalMinutes([])).toBe(0);
  });

  it("stays exact over a long run of thirds of an hour", () => {
    // The reason time is minutes: forty of these is 800 and not 799.992.
    const entries = Array.from({ length: 40 }, () => entry({ minutes: 20 }));
    expect(totalMinutes(entries)).toBe(800);
  });
});

describe("how much of a set is chargeable", () => {
  it("leaves the unticked entries out", () => {
    const entries = [
      entry({ minutes: 90 }),
      entry({ minutes: 60, billable: false }),
    ];
    expect(billableMinutes(entries)).toBe(90);
  });

  it("matches the total when every entry is chargeable", () => {
    const entries = [entry({ minutes: 90 }), entry({ minutes: 60 })];
    expect(billableMinutes(entries)).toBe(totalMinutes(entries));
  });

  it("comes to nothing when none of it is chargeable", () => {
    expect(billableMinutes([entry({ billable: false })])).toBe(0);
  });

  it("counts an unreadable flag as not chargeable", () => {
    // The column is an integer, so a hand-edited row can hold something that
    // is neither true nor false. Charging for it is the expensive mistake.
    const odd = { ...entry(), billable: 2 as unknown as boolean };
    expect(billableMinutes([odd])).toBe(0);
  });
});

describe("gathering entries into days", () => {
  it("has nothing to show for an empty list", () => {
    expect(groupTimeByDay([])).toEqual([]);
  });

  it("keeps the days in the order they first appear", () => {
    const days = groupTimeByDay([
      entry({ id: "a", workedOn: "2026-10-17" }),
      entry({ id: "b", workedOn: "2026-10-15" }),
    ]);
    expect(days.map((day) => day.workedOn)).toEqual([
      "2026-10-17",
      "2026-10-15",
    ]);
  });

  it("keeps the entries within a day in the order they arrived", () => {
    const days = groupTimeByDay([
      entry({ id: "a" }),
      entry({ id: "b" }),
      entry({ id: "c" }),
    ]);
    expect(days[0].entries.map((one) => one.id)).toEqual(["a", "b", "c"]);
  });

  it("gathers a day whose entries are not next to each other", () => {
    // The data layer never produces this. A day shown twice with two partial
    // totals is worth being right about anyway.
    const days = groupTimeByDay([
      entry({ id: "a", workedOn: "2026-10-17" }),
      entry({ id: "b", workedOn: "2026-10-15" }),
      entry({ id: "c", workedOn: "2026-10-17" }),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].entries.map((one) => one.id)).toEqual(["a", "c"]);
  });

  it("totals each day on its own", () => {
    const days = groupTimeByDay([
      entry({ minutes: 90, workedOn: "2026-10-17" }),
      entry({ minutes: 45, workedOn: "2026-10-17" }),
      entry({ minutes: 30, workedOn: "2026-10-15" }),
    ]);
    expect(days.map((day) => day.minutes)).toEqual([135, 30]);
  });

  it("says how much of each day is chargeable", () => {
    const days = groupTimeByDay([
      entry({ minutes: 90, workedOn: "2026-10-17" }),
      entry({ minutes: 45, workedOn: "2026-10-17", billable: false }),
    ]);
    expect(days[0].minutes).toBe(135);
    expect(days[0].billableMinutes).toBe(90);
  });

  it("hands the whole entry back rather than a copy of part of it", () => {
    const logged = entry({ id: "tme_call" });
    expect(groupTimeByDay([logged])[0].entries[0]).toBe(logged);
  });
});

describe("the running total on a day", () => {
  const entries = [
    entry({ minutes: 60, workedOn: "2026-10-17" }),
    entry({ minutes: 30, workedOn: "2026-10-16" }),
    entry({ minutes: 90, workedOn: "2026-10-14" }),
  ];

  it("counts everything on the day and every day before it", () => {
    const days = groupTimeByDay(entries);
    expect(days.map((day) => day.runningMinutes)).toEqual([180, 120, 90]);
  });

  it("ends up at the whole list on the newest day", () => {
    const days = groupTimeByDay(entries);
    expect(days[0].runningMinutes).toBe(totalMinutes(entries));
  });

  it("is the day's own total on the first day worked", () => {
    const days = groupTimeByDay(entries);
    expect(days[2].runningMinutes).toBe(days[2].minutes);
  });

  it("gives the same answer when the list arrives oldest first", () => {
    // Read off the calendar rather than off the array, so the figure does not
    // depend on which end the query handed over.
    const forwards = groupTimeByDay([...entries].reverse());
    expect(forwards.map((day) => day.runningMinutes)).toEqual([90, 120, 180]);
  });

  it("counts non-chargeable time towards it", () => {
    // It is a record of what the engagement has cost, not of what it will bill.
    const days = groupTimeByDay([
      entry({ minutes: 60, workedOn: "2026-10-17", billable: false }),
      entry({ minutes: 30, workedOn: "2026-10-16" }),
    ]);
    expect(days[0].runningMinutes).toBe(90);
  });
});

function day(fields: Partial<TimeDay> = {}): TimeDay {
  return {
    workedOn: "2026-10-17",
    entries: [],
    minutes: 270,
    billableMinutes: 270,
    runningMinutes: 765,
    ...fields,
  };
}

describe("what a day's heading says about the day", () => {
  it("says how long was logged", () => {
    expect(describeDayTotal(day())).toBe("4h 30m logged");
  });

  it("says nothing about chargeability when all of it is chargeable", () => {
    // A clause that is true on every day is a clause nobody reads, and the one
    // day it mattered would look like the rest.
    expect(describeDayTotal(day())).not.toMatch(/chargeable/);
  });

  it("says how much of the day will not be charged for", () => {
    expect(describeDayTotal(day({ billableMinutes: 210 }))).toBe(
      "4h 30m logged, 1h of it not chargeable",
    );
  });

  it("says so when none of the day is chargeable", () => {
    expect(describeDayTotal(day({ billableMinutes: 0 }))).toBe(
      "4h 30m logged, 4h 30m of it not chargeable",
    );
  });
});

describe("whether a day shows its running total", () => {
  it("shows it once there is something before the day", () => {
    expect(showsRunningTotal(day({ minutes: 270, runningMinutes: 765 }))).toBe(
      true,
    );
  });

  it("hides it on the oldest day, where it repeats the day's own total", () => {
    expect(showsRunningTotal(day({ minutes: 270, runningMinutes: 270 }))).toBe(
      false,
    );
  });

  it("hides it on a list holding one day", () => {
    const [only] = groupTimeByDay([entry({ minutes: 45 })]);
    expect(showsRunningTotal(only)).toBe(false);
  });
});

describe("a day's heading as one sentence", () => {
  it("names the day and what was logged on it", () => {
    expect(describeDay(day({ runningMinutes: 270 }))).toBe(
      "Oct 17, 2026 — 4h 30m logged",
    );
  });

  it("adds the running total once there is something before the day", () => {
    expect(describeDay(day())).toBe(
      "Oct 17, 2026 — 4h 30m logged — 12h 45m up to this day",
    );
  });

  it("carries the non-chargeable clause into it", () => {
    expect(describeDay(day({ billableMinutes: 210 }))).toContain(
      "1h of it not chargeable",
    );
  });

  it("reads the day off the string rather than through a Date", () => {
    // A `Date` would be a moment, and the moment a calendar date falls on is
    // the previous day for anybody behind UTC.
    expect(describeDay(day({ workedOn: "2026-01-01" }))).toMatch(
      /^Jan 1, 2026/,
    );
  });
});

describe("the line above a time list", () => {
  function listOf(...minutes: readonly [number, string][]) {
    return groupTimeByDay(
      minutes.map(([length, workedOn], index) =>
        entry({ id: `tme_${index}`, minutes: length, workedOn }),
      ),
    );
  }

  it("says there is nothing yet rather than counting to zero", () => {
    expect(describeTimeList([])).toBe(
      "No time logged against this project yet.",
    );
  });

  it("counts one entry in words and in the singular", () => {
    expect(describeTimeList(listOf([90, "2026-10-17"]))).toBe(
      "One entry, 1h 30m in total. It can be edited or deleted with the buttons beside it.",
    );
  });

  it("says a run of entries on one day happened on one day", () => {
    expect(
      describeTimeList(listOf([90, "2026-10-17"], [45, "2026-10-17"])),
    ).toBe(
      "2 entries on one day, 2h 15m in total. Each can be edited or deleted with the buttons beside it.",
    );
  });

  it("counts the days the work was spread over", () => {
    expect(
      describeTimeList(
        listOf([90, "2026-10-17"], [45, "2026-10-16"], [30, "2026-10-14"]),
      ),
    ).toBe(
      "3 entries over 3 days, 2h 45m in total. Each can be edited or deleted with the buttons beside it.",
    );
  });

  it("totals the whole list rather than the newest day", () => {
    const said = describeTimeList(
      listOf([90, "2026-10-17"], [90, "2026-10-16"]),
    );
    expect(said).toContain("3h in total");
  });

  it("says where the controls are", () => {
    expect(describeTimeList(listOf([90, "2026-10-17"]))).toContain(
      "buttons beside it",
    );
  });
});

describe("the figures that qualify a day's total", () => {
  it("has nothing to add to an all-chargeable oldest day", () => {
    expect(dayQualifiers(day({ runningMinutes: 270 }))).toEqual([]);
  });

  it("says where the engagement stands", () => {
    expect(dayQualifiers(day())).toEqual(["12h 45m up to this day"]);
  });

  it("says how much of the day will not be charged for", () => {
    expect(dayQualifiers(day({ billableMinutes: 210 }))).toEqual([
      "1h not chargeable",
      "12h 45m up to this day",
    ]);
  });

  it("puts the day's own qualifier before the one about the list", () => {
    // The reader is looking at a day. What it cost comes before where it sits.
    expect(dayQualifiers(day({ billableMinutes: 210 }))[0]).toContain(
      "not chargeable",
    );
  });

  it("leaves the date out, which the heading beside it already shows", () => {
    for (const qualifier of dayQualifiers(day({ billableMinutes: 0 }))) {
      expect(qualifier).not.toContain("Oct");
    }
  });
});
