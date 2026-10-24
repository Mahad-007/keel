import { describe, expect, it } from "vitest";

import {
  compareToEstimate,
  entriesByDeliverable,
  loggedShare,
  loggedTotals,
  rollUpDeliverable,
  rollUpProject,
  scopeDelivered,
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

describe("rolling a whole project up against its scope list", () => {
  const scope = [
    line({ id: "dlv_a", title: "Homepage build", estimatedMinutes: 240 }),
    line({ id: "dlv_b", title: "Revision round", estimatedMinutes: 120 }),
  ];

  it("gives every line a row, in the order the scope list was agreed in", () => {
    const rolled = rollUpProject(scope, []);
    expect(rolled.lines.map((one) => one.title)).toEqual([
      "Homepage build",
      "Revision round",
    ]);
  });

  it("sends each entry to the line it was attributed to", () => {
    const rolled = rollUpProject(scope, [
      entry({ minutes: 300, deliverableId: "dlv_a" }),
      entry({ minutes: 30, deliverableId: "dlv_b" }),
    ]);
    expect(rolled.lines[0].loggedMinutes).toBe(300);
    expect(rolled.lines[0].varianceMinutes).toBe(60);
    expect(rolled.lines[1].loggedMinutes).toBe(30);
    expect(rolled.lines[1].varianceMinutes).toBe(-90);
  });

  it("keeps a row for a line nothing has been logged against", () => {
    // The eight-hour line three weeks in that nobody has started is the row
    // worth looking at, and a table of only the busy lines would drop it.
    const rolled = rollUpProject(scope, [
      entry({ minutes: 60, deliverableId: "dlv_a" }),
    ]);
    expect(rolled.lines).toHaveLength(2);
    expect(rolled.lines[1].loggedMinutes).toBe(0);
  });

  it("totals the project's estimate as the scope summary does", () => {
    expect(rollUpProject(scope, []).estimatedMinutes).toBe(360);
  });

  it("sets the project's logged time against that estimate", () => {
    const rolled = rollUpProject(scope, [
      entry({ minutes: 300, deliverableId: "dlv_a" }),
      entry({ minutes: 180, deliverableId: "dlv_b" }),
    ]);
    expect(rolled.loggedMinutes).toBe(480);
    expect(rolled.varianceMinutes).toBe(120);
    expect(rolled.loggedShare).toBe(480 / 360);
  });

  it("reports the time that went against no line on its own", () => {
    const rolled = rollUpProject(scope, [
      entry({ minutes: 45, deliverableId: null }),
      entry({ minutes: 60, deliverableId: "dlv_a" }),
    ]);
    expect(rolled.unattributed.loggedMinutes).toBe(45);
    expect(rolled.unattributed.entryCount).toBe(1);
    expect(rolled.lines[0].loggedMinutes).toBe(60);
  });

  it("counts unattributed time in the project total all the same", () => {
    // It happened, and the project paid for it. Only the rows leave it out.
    const rolled = rollUpProject(scope, [entry({ minutes: 45 })]);
    expect(rolled.loggedMinutes).toBe(45);
    expect(rolled.entryCount).toBe(1);
  });

  it("rolls a project with no scope list up to a total and no rows", () => {
    const rolled = rollUpProject([], [entry({ minutes: 45 })]);
    expect(rolled.lines).toEqual([]);
    expect(rolled.loggedMinutes).toBe(45);
    expect(rolled.estimatedMinutes).toBe(0);
    expect(rolled.varianceMinutes).toBeNull();
  });

  it("rolls a project nobody has logged against up to zeroes", () => {
    const rolled = rollUpProject(scope, []);
    expect(rolled.loggedMinutes).toBe(0);
    expect(rolled.entryCount).toBe(0);
    expect(rolled.unattributed.loggedMinutes).toBe(0);
    expect(rolled.unmatchedMinutes).toBe(0);
    expect(rolled.loggedShare).toBe(0);
  });
});

describe("the project total against the parts it is made of", () => {
  const scope = [
    line({ id: "dlv_a", estimatedMinutes: 240 }),
    line({ id: "dlv_b", estimatedMinutes: 120 }),
  ];

  function parts(rolled: ReturnType<typeof rollUpProject>): number {
    const onLines = rolled.lines.reduce(
      (sum, one) => sum + one.loggedMinutes,
      0,
    );
    return onLines + rolled.unattributed.loggedMinutes + rolled.unmatchedMinutes;
  }

  it("adds up when every entry is attributed to a line", () => {
    const rolled = rollUpProject(scope, [
      entry({ minutes: 90, deliverableId: "dlv_a" }),
      entry({ minutes: 45, deliverableId: "dlv_b" }),
    ]);
    expect(parts(rolled)).toBe(rolled.loggedMinutes);
  });

  it("adds up with loose time in the list", () => {
    const rolled = rollUpProject(scope, [
      entry({ minutes: 90, deliverableId: "dlv_a" }),
      entry({ minutes: 45, deliverableId: null }),
    ]);
    expect(parts(rolled)).toBe(rolled.loggedMinutes);
  });

  it("adds up with an entry pointing at a line the rollup does not hold", () => {
    // The stale-page case. The unmatched figure is what keeps the table's
    // column equal to the total under it.
    const rolled = rollUpProject(scope, [
      entry({ minutes: 90, deliverableId: "dlv_a" }),
      entry({ minutes: 25, deliverableId: "dlv_gone" }),
    ]);
    expect(rolled.unmatchedMinutes).toBe(25);
    expect(rolled.loggedMinutes).toBe(115);
    expect(parts(rolled)).toBe(rolled.loggedMinutes);
  });
});

describe("whether the whole scope list is done", () => {
  it("calls a list whose every line is delivered done", () => {
    const rollup = rollUpProject(
      [line({ status: "done" }), line({ id: "dlv_b", status: "done" })],
      [],
    );
    expect(scopeDelivered(rollup)).toBe(true);
  });

  it("is not done while one line is still open", () => {
    const rollup = rollUpProject(
      [line({ status: "done" }), line({ id: "dlv_b", status: "pending" })],
      [],
    );
    expect(scopeDelivered(rollup)).toBe(false);
  });

  it("is not done while a line is started, as the scope summary has it", () => {
    const rollup = rollUpProject([line({ status: "started" })], []);
    expect(scopeDelivered(rollup)).toBe(false);
  });

  it("refuses to call a project with no scope list done", () => {
    // There is no agreement to have finished, and calling one complete would
    // read every project nobody has scoped as a success.
    expect(scopeDelivered(rollUpProject([], []))).toBe(false);
  });
});
