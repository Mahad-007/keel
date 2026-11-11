import { describe, expect, it } from "vitest";

import {
  dayTotals,
  DAY_CAPACITY_MINUTES,
  IMPLAUSIBLE_ENTRY_MINUTES,
  negativeEntry,
  overfullDay,
  overlongEntry,
  type SuspectEntry,
} from "./implausible";

function entry(fields: Partial<SuspectEntry> = {}): SuspectEntry {
  return { id: "tme_1", minutes: 90, workedOn: "2026-10-17", ...fields };
}

describe("an entry recording less than no time", () => {
  it("flags a duration below zero", () => {
    expect(negativeEntry({ minutes: -30 })).toBe(true);
  });

  it("leaves an ordinary duration alone", () => {
    expect(negativeEntry({ minutes: 90 })).toBe(false);
  });

  it("leaves zero alone", () => {
    // It counts for nothing in every total, which is the same as not being
    // there. A negative one subtracts, which is worse than not being there.
    expect(negativeEntry({ minutes: 0 })).toBe(false);
  });

  it("flags the first minute below zero", () => {
    expect(negativeEntry({ minutes: -1 })).toBe(true);
  });
});

describe("one stretch longer than a stretch plausibly is", () => {
  it("flags thirteen hours", () => {
    expect(overlongEntry({ minutes: 13 * 60 })).toBe(true);
  });

  it("leaves twelve hours alone", () => {
    // A day somebody had, and a round figure that gets typed on purpose.
    expect(overlongEntry({ minutes: IMPLAUSIBLE_ENTRY_MINUTES })).toBe(false);
  });

  it("flags the first minute past twelve hours", () => {
    expect(overlongEntry({ minutes: IMPLAUSIBLE_ENTRY_MINUTES + 1 })).toBe(
      true,
    );
  });

  it("leaves an ordinary afternoon alone", () => {
    expect(overlongEntry({ minutes: 210 })).toBe(false);
  });

  it("does not flag a negative duration as a long one", () => {
    // So the two flags cannot both be true of one entry.
    expect(overlongEntry({ minutes: -900 })).toBe(false);
  });
});

describe("how many minutes each day holds", () => {
  it("adds up the entries filed under one day", () => {
    const totals = dayTotals([
      entry({ minutes: 90 }),
      entry({ minutes: 45 }),
    ]);
    expect(totals.get("2026-10-17")).toBe(135);
  });

  it("keeps the days apart", () => {
    const totals = dayTotals([
      entry({ workedOn: "2026-10-17", minutes: 90 }),
      entry({ workedOn: "2026-10-18", minutes: 45 }),
    ]);
    expect([...totals]).toEqual([
      ["2026-10-17", 90],
      ["2026-10-18", 45],
    ]);
  });

  it("gathers entries sharing a day that are not next to each other", () => {
    const totals = dayTotals([
      entry({ workedOn: "2026-10-17", minutes: 90 }),
      entry({ workedOn: "2026-10-18", minutes: 45 }),
      entry({ workedOn: "2026-10-17", minutes: 30 }),
    ]);
    expect(totals.get("2026-10-17")).toBe(120);
  });

  it("holds no days at all for no entries", () => {
    expect(dayTotals([]).size).toBe(0);
  });

  it("lets a negative entry pull its day down", () => {
    // Which is exactly what makes one worth flagging: the day it is on reads
    // as shorter than it was.
    const totals = dayTotals([
      entry({ minutes: 480 }),
      entry({ minutes: -60 }),
    ]);
    expect(totals.get("2026-10-17")).toBe(420);
  });
});

describe("a day holding more than a day has", () => {
  it("flags twenty-six hours", () => {
    expect(overfullDay(26 * 60)).toBe(true);
  });

  it("leaves a day logged as exactly full alone", () => {
    // Nobody arrives at 1440 by accident, and a clear twenty-four hours is a
    // day worth remembering rather than one worth querying.
    expect(overfullDay(DAY_CAPACITY_MINUTES)).toBe(false);
  });

  it("flags the first minute past a full day", () => {
    expect(overfullDay(DAY_CAPACITY_MINUTES + 1)).toBe(true);
  });

  it("leaves an ordinary day alone", () => {
    expect(overfullDay(7 * 60)).toBe(false);
  });

  it("leaves a day a negative entry has pulled below zero alone", () => {
    // The entry is flagged on its own account; the day is not the complaint.
    expect(overfullDay(-120)).toBe(false);
  });
});
