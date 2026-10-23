import { describe, expect, it } from "vitest";

import {
  compareToEstimate,
  entriesByDeliverable,
  loggedShare,
  loggedTotals,
  rollUpDeliverable,
  unattributedEntries,
  unmatchedMinutes,
  varianceMinutes,
  type AttributedEntry,
  type RolledUpDeliverable,
} from "./rollup";

function entry(fields: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    id: "tme_1",
    minutes: 30,
    workedOn: "2026-10-17",
    billable: true,
    deliverableId: null,
    ...fields,
  };
}

function line(fields: Partial<RolledUpDeliverable> = {}): RolledUpDeliverable {
  return {
    id: "dlv_a",
    title: "Homepage build",
    estimatedMinutes: 240,
    status: "pending",
    ...fields,
  };
}

describe("what a set of entries comes to", () => {
  it("counts the entries and adds up their minutes", () => {
    const totals = loggedTotals([
      entry({ minutes: 90 }),
      entry({ minutes: 45 }),
    ]);
    expect(totals.entryCount).toBe(2);
    expect(totals.loggedMinutes).toBe(135);
  });

  it("comes to three zeroes for a line nobody has logged against", () => {
    expect(loggedTotals([])).toEqual({
      entryCount: 0,
      loggedMinutes: 0,
      billableMinutes: 0,
    });
  });

  it("leaves the unticked entries out of the chargeable figure only", () => {
    const totals = loggedTotals([
      entry({ minutes: 90 }),
      entry({ minutes: 60, billable: false }),
    ]);
    expect(totals.loggedMinutes).toBe(150);
    expect(totals.billableMinutes).toBe(90);
  });

  it("counts a flag that is neither true nor false as not chargeable", () => {
    // The column is an integer, so a hand-edited row can hold a 2. The whole
    // 30 minutes happened; none of it is charged for.
    const odd = { ...entry(), billable: 2 as unknown as boolean };
    const totals = loggedTotals([odd]);
    expect(totals.loggedMinutes).toBe(30);
    expect(totals.billableMinutes).toBe(0);
  });
});

describe("how far logged time has run past its estimate", () => {
  it("reports time over the estimate as a positive figure", () => {
    expect(varianceMinutes(360, 240)).toBe(120);
  });

  it("reports time short of the estimate as a negative one", () => {
    expect(varianceMinutes(180, 240)).toBe(-60);
  });

  it("reports a line logged to its estimate exactly as nought", () => {
    expect(varianceMinutes(240, 240)).toBe(0);
  });

  it("reports an estimated line nobody has logged against as under by all of it", () => {
    expect(varianceMinutes(0, 240)).toBe(-240);
  });

  it("refuses to compare a line nobody estimated", () => {
    // Not nought: six hours against no estimate is not six hours over.
    expect(varianceMinutes(360, 0)).toBeNull();
  });

  it("refuses to compare an unestimated line with nothing logged either", () => {
    expect(varianceMinutes(0, 0)).toBeNull();
  });

  it("compares a negative estimate rather than dropping the line", () => {
    // Only a hand-edited row gets here. The figure is odd and visible, which
    // is the point — a line missing from the column is harder to find.
    expect(varianceMinutes(60, -120)).toBe(180);
  });
});

describe("how much of an estimate the logged time has used", () => {
  it("reads half an estimate as half", () => {
    expect(loggedShare(120, 240)).toBe(0.5);
  });

  it("reads a line logged to its estimate as all of it", () => {
    expect(loggedShare(240, 240)).toBe(1);
  });

  it("leaves a runaway line above one rather than capping it", () => {
    // 240% is the most useful figure this file produces. Clamping it would
    // make a line that has taken two and a half times its estimate look done.
    expect(loggedShare(600, 240)).toBe(2.5);
  });

  it("reads an estimated line nobody has logged against as nothing used", () => {
    expect(loggedShare(0, 240)).toBe(0);
  });

  it("has no share to take of a line nobody estimated", () => {
    expect(loggedShare(360, 0)).toBeNull();
  });

  it("has no share to take of a negative estimate", () => {
    // Dividing by it would flip the sign and report the line as healthy.
    expect(loggedShare(360, -240)).toBeNull();
  });

  it("does not round, leaving that to whatever prints it", () => {
    expect(loggedShare(100, 300)).toBeCloseTo(1 / 3, 12);
  });
});

describe("setting logged minutes against an estimate", () => {
  it("echoes the estimate back beside both readings of it", () => {
    expect(compareToEstimate(360, 240)).toEqual({
      estimatedMinutes: 240,
      varianceMinutes: 120,
      loggedShare: 1.5,
    });
  });

  it("has neither reading for a line nobody estimated", () => {
    expect(compareToEstimate(360, 0)).toEqual({
      estimatedMinutes: 0,
      varianceMinutes: null,
      loggedShare: null,
    });
  });

  it("keeps the difference but not the share on a negative estimate", () => {
    // Subtracting from it is arithmetic a reader can redo; dividing by it
    // flips the sign into a figure that reads as healthy.
    expect(compareToEstimate(60, -120)).toEqual({
      estimatedMinutes: -120,
      varianceMinutes: 180,
      loggedShare: null,
    });
  });
});

describe("filing entries under the line each went against", () => {
  it("gathers the entries for one deliverable under its id", () => {
    const first = entry({ id: "tme_1", deliverableId: "dlv_a" });
    const second = entry({ id: "tme_2", deliverableId: "dlv_a" });
    const byDeliverable = entriesByDeliverable([first, second]);
    expect(byDeliverable.get("dlv_a")).toEqual([first, second]);
  });

  it("keeps two lines' entries apart", () => {
    const a = entry({ id: "tme_1", deliverableId: "dlv_a" });
    const b = entry({ id: "tme_2", deliverableId: "dlv_b" });
    const byDeliverable = entriesByDeliverable([a, b]);
    expect(byDeliverable.get("dlv_a")).toEqual([a]);
    expect(byDeliverable.get("dlv_b")).toEqual([b]);
  });

  it("gathers entries sharing a line that are not next to each other", () => {
    const first = entry({ id: "tme_1", deliverableId: "dlv_a" });
    const other = entry({ id: "tme_2", deliverableId: "dlv_b" });
    const third = entry({ id: "tme_3", deliverableId: "dlv_a" });
    expect(entriesByDeliverable([first, other, third]).get("dlv_a")).toEqual([
      first,
      third,
    ]);
  });

  it("keeps the order the caller handed the entries over in", () => {
    // The data layer orders newest first, and this must not re-sort it.
    const newer = entry({ id: "tme_2", workedOn: "2026-10-18", deliverableId: "dlv_a" });
    const older = entry({ id: "tme_1", workedOn: "2026-10-11", deliverableId: "dlv_a" });
    expect(
      entriesByDeliverable([newer, older]).get("dlv_a")?.map((one) => one.id),
    ).toEqual(["tme_2", "tme_1"]);
  });

  it("leaves unattributed time out of the map entirely", () => {
    const byDeliverable = entriesByDeliverable([
      entry({ deliverableId: null }),
    ]);
    expect(byDeliverable.size).toBe(0);
  });

  it("has no bucket for a line nothing was logged against", () => {
    expect(entriesByDeliverable([]).get("dlv_a")).toBeUndefined();
  });
});

describe("the entries that went against no line", () => {
  it("picks out the ones with no attribution", () => {
    const loose = entry({ id: "tme_1", deliverableId: null });
    const attributed = entry({ id: "tme_2", deliverableId: "dlv_a" });
    expect(unattributedEntries([loose, attributed])).toEqual([loose]);
  });

  it("comes back empty when every entry went against a line", () => {
    expect(unattributedEntries([entry({ deliverableId: "dlv_a" })])).toEqual(
      [],
    );
  });
});

describe("rolling one deliverable up against its estimate", () => {
  it("names the line and sets its logged time against its estimate", () => {
    const rolled = rollUpDeliverable(line(), [
      entry({ minutes: 200, deliverableId: "dlv_a" }),
      entry({ minutes: 160, deliverableId: "dlv_a" }),
    ]);
    expect(rolled.deliverableId).toBe("dlv_a");
    expect(rolled.title).toBe("Homepage build");
    expect(rolled.loggedMinutes).toBe(360);
    expect(rolled.estimatedMinutes).toBe(240);
    expect(rolled.varianceMinutes).toBe(120);
    expect(rolled.loggedShare).toBe(1.5);
  });

  it("rolls a line nothing has been logged against up to nothing used", () => {
    const rolled = rollUpDeliverable(line(), []);
    expect(rolled.entryCount).toBe(0);
    expect(rolled.loggedMinutes).toBe(0);
    expect(rolled.varianceMinutes).toBe(-240);
    expect(rolled.loggedShare).toBe(0);
  });

  it("carries the chargeable figure separately from the logged one", () => {
    const rolled = rollUpDeliverable(line(), [
      entry({ minutes: 120, deliverableId: "dlv_a" }),
      entry({ minutes: 60, deliverableId: "dlv_a", billable: false }),
    ]);
    expect(rolled.loggedMinutes).toBe(180);
    expect(rolled.billableMinutes).toBe(120);
    // The variance is against everything logged. Absorbing an hour does not
    // mean the hour did not happen.
    expect(rolled.varianceMinutes).toBe(-60);
  });

  it("calls a line done when the scope list calls it done", () => {
    expect(rollUpDeliverable(line({ status: "done" }), []).delivered).toBe(
      true,
    );
  });

  it("calls a started line not done, the way the scope summary does", () => {
    // Half credit for a started line is a number nobody supplied.
    expect(
      rollUpDeliverable(line({ status: "started" }), []).delivered,
    ).toBe(false);
  });

  it("refuses to compare an unsized line however much went into it", () => {
    const rolled = rollUpDeliverable(line({ estimatedMinutes: 0 }), [
      entry({ minutes: 480, deliverableId: "dlv_a" }),
    ]);
    expect(rolled.loggedMinutes).toBe(480);
    expect(rolled.varianceMinutes).toBeNull();
    expect(rolled.loggedShare).toBeNull();
  });
});

describe("time attributed to a line the rollup was not given", () => {
  const known = new Set(["dlv_a"]);

  it("comes to nothing when every attribution is one of the lines", () => {
    expect(
      unmatchedMinutes([entry({ deliverableId: "dlv_a" })], known),
    ).toBe(0);
  });

  it("counts the minutes pointing at a line that is not there", () => {
    expect(
      unmatchedMinutes(
        [
          entry({ minutes: 90, deliverableId: "dlv_a" }),
          entry({ minutes: 45, deliverableId: "dlv_gone" }),
        ],
        known,
      ),
    ).toBe(45);
  });

  it("does not count unattributed time, which is an answer and not a gap", () => {
    expect(unmatchedMinutes([entry({ deliverableId: null })], known)).toBe(0);
  });

  it("counts everything when the rollup was given no lines at all", () => {
    expect(
      unmatchedMinutes([entry({ minutes: 60, deliverableId: "dlv_a" })], new Set()),
    ).toBe(60);
  });
});
