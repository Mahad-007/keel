import { describe, expect, it } from "vitest";

import {
  dayTotals,
  DAY_CAPACITY_MINUTES,
  describeImplausibleEntries,
  describeProblem,
  entryProblems,
  flagImplausibleEntries,
  IMPLAUSIBLE_ENTRY_MINUTES,
  IMPLAUSIBLE_MARK,
  negativeEntry,
  NO_PROBLEMS,
  overfullDay,
  overlongEntry,
  problemsByEntry,
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

describe("everything that looks wrong with one entry", () => {
  it("finds nothing wrong with an ordinary entry on an ordinary day", () => {
    expect(entryProblems({ minutes: 90 }, 420)).toEqual([]);
  });

  it("reports a negative duration", () => {
    expect(entryProblems({ minutes: -60 }, 360)).toEqual([
      { reason: "negative" },
    ]);
  });

  it("reports a stretch past twelve hours", () => {
    expect(entryProblems({ minutes: 13 * 60 }, 13 * 60)).toEqual([
      { reason: "overlong" },
    ]);
  });

  it("reports an overfull day, naming what it comes to", () => {
    expect(entryProblems({ minutes: 90 }, 26 * 60)).toEqual([
      { reason: "overlapping", dayMinutes: 26 * 60 },
    ]);
  });

  it("reports both when a long entry sits on an impossible day", () => {
    // Two separate things worth saying: this figure is implausible, and the
    // day it is on cannot have happened.
    expect(entryProblems({ minutes: 13 * 60 }, 31 * 60)).toEqual([
      { reason: "overlong" },
      { reason: "overlapping", dayMinutes: 31 * 60 },
    ]);
  });

  it("puts the entry's own problem before the day's", () => {
    const problems = entryProblems({ minutes: -60 }, 25 * 60);
    expect(problems.map((problem) => problem.reason)).toEqual([
      "negative",
      "overlapping",
    ]);
  });

  it("never reports a negative entry as a long one as well", () => {
    expect(entryProblems({ minutes: -2000 }, 0)).toEqual([
      { reason: "negative" },
    ]);
  });
});

describe("the entries in a set that look wrong", () => {
  it("leaves an ordinary list unflagged", () => {
    const entries = [
      entry({ id: "tme_1", minutes: 90 }),
      entry({ id: "tme_2", minutes: 150 }),
    ];
    expect(flagImplausibleEntries(entries)).toEqual([]);
  });

  it("returns only the entries with something wrong with them", () => {
    const flagged = flagImplausibleEntries([
      entry({ id: "tme_1", minutes: 90 }),
      entry({ id: "tme_2", minutes: 13 * 60, workedOn: "2026-10-18" }),
      entry({ id: "tme_3", minutes: 45 }),
    ]);
    expect(flagged.map(({ entry: one }) => one.id)).toEqual(["tme_2"]);
  });

  it("hands the whole row back so the caller can name it", () => {
    const one = entry({ id: "tme_2", minutes: -60 });
    expect(flagImplausibleEntries([one])[0].entry).toBe(one);
  });

  it("keeps the order it was given", () => {
    const flagged = flagImplausibleEntries([
      entry({ id: "tme_late", minutes: -30, workedOn: "2026-10-19" }),
      entry({ id: "tme_early", minutes: -30, workedOn: "2026-10-17" }),
    ]);
    expect(flagged.map(({ entry: one }) => one.id)).toEqual([
      "tme_late",
      "tme_early",
    ]);
  });

  it("flags every entry on an overfull day, not just the longest", () => {
    // Nothing in the data says which of them is the wrong one, and claiming
    // otherwise would send a reader to correct whichever row looked biggest.
    const flagged = flagImplausibleEntries([
      entry({ id: "tme_1", minutes: 14 * 60 }),
      entry({ id: "tme_2", minutes: 11 * 60 }),
    ]);
    expect(flagged.map(({ entry: one }) => one.id)).toEqual([
      "tme_1",
      "tme_2",
    ]);
    expect(flagged[1].problems).toEqual([
      { reason: "overlapping", dayMinutes: 25 * 60 },
    ]);
  });

  it("leaves a neighbouring day out of an overfull day's reckoning", () => {
    const flagged = flagImplausibleEntries([
      entry({ id: "tme_1", minutes: 13 * 60, workedOn: "2026-10-17" }),
      entry({ id: "tme_2", minutes: 13 * 60, workedOn: "2026-10-18" }),
    ]);
    expect(flagged.map(({ problems }) => problems)).toEqual([
      [{ reason: "overlong" }],
      [{ reason: "overlong" }],
    ]);
  });

  it("lets a negative entry keep its own day from reading as overfull", () => {
    // Which is honest: a day whose figures include a negative one is not a
    // day with too many hours in it, it is a day with a bad row in it.
    const flagged = flagImplausibleEntries([
      entry({ id: "tme_1", minutes: 25 * 60 }),
      entry({ id: "tme_2", minutes: -120 }),
    ]);
    expect(flagged.map(({ entry: one, problems }) => [one.id, problems])).toEqual(
      [
        ["tme_1", [{ reason: "overlong" }]],
        ["tme_2", [{ reason: "negative" }]],
      ],
    );
  });

  it("flags nothing in an empty list", () => {
    expect(flagImplausibleEntries([])).toEqual([]);
  });
});

describe("the flags keyed by the entry they are about", () => {
  it("finds a flagged entry by its id", () => {
    const flagged = flagImplausibleEntries([
      entry({ id: "tme_1", minutes: 90 }),
      entry({ id: "tme_2", minutes: -60 }),
    ]);
    expect(problemsByEntry(flagged).get("tme_2")).toEqual([
      { reason: "negative" },
    ]);
  });

  it("holds nothing for an entry with nothing wrong with it", () => {
    const flagged = flagImplausibleEntries([entry({ id: "tme_1" })]);
    expect(problemsByEntry(flagged).get("tme_1")).toBeUndefined();
  });

  it("is empty for a list with nothing to question", () => {
    expect(problemsByEntry([]).size).toBe(0);
  });

  it("has an empty list of problems for a row to fall back on", () => {
    expect(NO_PROBLEMS).toEqual([]);
  });
});

describe("why one entry is flagged, in a sentence", () => {
  it("names the duration a negative entry subtracts", () => {
    const said = describeProblem({ minutes: -60, workedOn: "2026-10-17" }, {
      reason: "negative",
    });
    expect(said).toContain("-1h");
    expect(said).toContain("written straight to the database");
  });

  it("names the stretch and the threshold it passed", () => {
    const said = describeProblem({ minutes: 13 * 60, workedOn: "2026-10-17" }, {
      reason: "overlong",
    });
    expect(said).toContain("13h");
    expect(said).toContain("12 hours");
  });

  it("allows that a long stretch may be right", () => {
    // Nothing here has been refused, and the sentence must not read as one.
    const said = describeProblem({ minutes: 14 * 60, workedOn: "2026-10-17" }, {
      reason: "overlong",
    });
    expect(said).toContain("may be right");
  });

  it("names the day and what it comes to for an overfull one", () => {
    const said = describeProblem({ minutes: 90, workedOn: "2026-10-17" }, {
      reason: "overlapping",
      dayMinutes: 26 * 60,
    });
    expect(said).toContain("Oct 17, 2026");
    expect(said).toContain("26h");
    expect(said).toContain("cover the same hours");
  });

  it("marks a flagged row without claiming it is invalid", () => {
    expect(IMPLAUSIBLE_MARK).toBe("Looks wrong");
  });
});

describe("the line above a flagged list", () => {
  it("says nothing at all when nothing is flagged", () => {
    expect(describeImplausibleEntries(0)).toBeNull();
  });

  it("counts one entry in the singular", () => {
    expect(describeImplausibleEntries(1)).toContain("One entry");
  });

  it("counts several", () => {
    expect(describeImplausibleEntries(3)).toContain("3 entries");
  });

  it("says the flagged time is still counted", () => {
    // Otherwise every figure above it is read as though these hours were held
    // back, which they are not.
    expect(describeImplausibleEntries(2)).toContain("the figures above include");
  });

  it("says nothing for a count below zero", () => {
    expect(describeImplausibleEntries(-1)).toBeNull();
  });
});
