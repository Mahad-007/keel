import { describe, expect, it } from "vitest";

import {
  billableMinutes,
  groupTimeByDay,
  totalMinutes,
  type LoggedEntry,
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
