import { describe, expect, it } from "vitest";

import { estimatedHours } from "@/lib/scope";

import type { CapturedScopeLine, SnapshotLineDraft } from "./capture";
import {
  diffScope,
  movedScopeLines,
  scopeDiffEntries,
  scopeFieldChanges,
  summariseScopeDiff,
  type ComparableScopeLine,
} from "./diff";

const LINE: ComparableScopeLine = {
  title: "Discovery",
  description: "Two workshops.",
  estimatedMinutes: 480,
  status: "pending",
};

describe("scopeFieldChanges", () => {
  it("says nothing about a line that reads exactly as it did", () => {
    expect(scopeFieldChanges(LINE, { ...LINE })).toEqual([]);
  });

  it("reports a retitled line with both titles", () => {
    expect(
      scopeFieldChanges(LINE, { ...LINE, title: "Discovery phase" }),
    ).toEqual([
      { field: "title", before: "Discovery", after: "Discovery phase" },
    ]);
  });

  it("reports an estimate that moved, in minutes", () => {
    expect(scopeFieldChanges(LINE, { ...LINE, estimatedMinutes: 960 })).toEqual(
      [{ field: "estimate", before: 480, after: 960 }],
    );
  });

  it("reports a line that has since been sized", () => {
    expect(
      scopeFieldChanges(
        { ...LINE, estimatedMinutes: 0 },
        { ...LINE, estimatedMinutes: 120 },
      ),
    ).toEqual([{ field: "estimate", before: 0, after: 120 }]);
  });

  it("reports a status that moved", () => {
    expect(scopeFieldChanges(LINE, { ...LINE, status: "done" })).toEqual([
      { field: "status", before: "pending", after: "done" },
    ]);
  });

  it("reports a description that was added", () => {
    expect(scopeFieldChanges({ ...LINE, description: null }, LINE)).toEqual([
      { field: "description", before: null, after: "Two workshops." },
    ]);
  });

  it("reports a description that was taken away", () => {
    expect(scopeFieldChanges(LINE, { ...LINE, description: null })).toEqual([
      { field: "description", before: "Two workshops.", after: null },
    ]);
  });

  it("reports several changes in the order a line is read", () => {
    const changes = scopeFieldChanges(LINE, {
      title: "Discovery phase",
      description: null,
      estimatedMinutes: 960,
      status: "started",
    });

    // Title, then the estimate the summary is built on, then the status, then
    // the paragraph nobody should have to read past.
    expect(changes.map((change) => change.field)).toEqual([
      "title",
      "estimate",
      "status",
      "description",
    ]);
  });

  it("counts a whitespace-only edit to a title as a change", () => {
    // Both sides came through the same guard, so the difference is an edit
    // rather than noise — and a line that does not match what was captured
    // must not report as unchanged.
    expect(scopeFieldChanges(LINE, { ...LINE, title: "Discovery " })).toEqual([
      { field: "title", before: "Discovery", after: "Discovery " },
    ]);
  });

  it("compares a status the app does not recognise rather than crashing", () => {
    expect(scopeFieldChanges({ ...LINE, status: "blocked" }, LINE)).toEqual([
      { field: "status", before: "blocked", after: "pending" },
    ]);
  });
});

/** A snapshot line, with the fields a test is not about left alone. */
function captured(
  deliverableId: string,
  over: Partial<SnapshotLineDraft> = {},
): SnapshotLineDraft {
  return {
    deliverableId,
    title: deliverableId,
    description: null,
    estimatedMinutes: 60,
    status: "pending",
    ...over,
  };
}

/** The same line as the scope list holds it now. */
function live(
  id: string,
  over: Partial<CapturedScopeLine> = {},
): CapturedScopeLine {
  return {
    id,
    title: id,
    description: null,
    estimatedMinutes: 60,
    status: "pending",
    ...over,
  };
}

describe("scopeDiffEntries", () => {
  it("calls a line in both lists and reading the same unchanged", () => {
    const [entry] = scopeDiffEntries([captured("a")], [live("a")]);

    expect(entry.kind).toBe("unchanged");
    expect(entry.changes).toEqual([]);
    expect(entry.before).not.toBeNull();
    expect(entry.after).not.toBeNull();
  });

  it("calls a line only in the scope list added", () => {
    const [entry] = scopeDiffEntries([], [live("a")]);

    expect(entry).toMatchObject({ deliverableId: "a", kind: "added" });
    expect(entry.before).toBeNull();
    expect(entry.after).toEqual(live("a"));
  });

  it("calls a line only in the snapshot removed, and keeps what it said", () => {
    const line = captured("a", {
      title: "Migrate the old posts",
      estimatedMinutes: 360,
    });
    const [entry] = scopeDiffEntries([line], []);

    expect(entry).toMatchObject({ deliverableId: "a", kind: "removed" });
    expect(entry.after).toBeNull();
    // The snapshot is the only place a dropped line's title still exists.
    expect(entry.before).toEqual(line);
  });

  it("calls a line that reads differently changed, with the differences", () => {
    const [entry] = scopeDiffEntries(
      [captured("a", { title: "Discovery" })],
      [live("a", { title: "Discovery phase" })],
    );

    expect(entry.kind).toBe("changed");
    expect(entry.changes).toEqual([
      { field: "title", before: "Discovery", after: "Discovery phase" },
    ]);
  });

  it("pairs on the deliverable rather than the title", () => {
    // A retitled line is one change, not a removal and an addition.
    const entries = scopeDiffEntries(
      [captured("a", { title: "Discovery" })],
      [live("a", { title: "Something else entirely" })],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("changed");
  });

  it("reads a deleted and retyped line as two rows", () => {
    // The cost of pairing on the id, and the right way round: it did happen
    // twice, and the second row is not the first one edited.
    const entries = scopeDiffEntries(
      [captured("a", { title: "Discovery" })],
      [live("b", { title: "Discovery" })],
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["added", "removed"]);
  });
});

describe("scopeDiffEntries ordering", () => {
  it("reads in the order the scope list reads", () => {
    const entries = scopeDiffEntries(
      [captured("b"), captured("a")],
      [live("a"), live("b"), live("c")],
    );

    expect(entries.map((entry) => entry.deliverableId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("puts the lines dropped since at the end, in the snapshot's order", () => {
    const entries = scopeDiffEntries(
      [captured("x"), captured("a"), captured("y")],
      [live("a"), live("b")],
    );

    // A removed line has no position in the current list, so there is nowhere
    // honest to interleave it.
    expect(entries.map((entry) => entry.deliverableId)).toEqual([
      "a",
      "b",
      "x",
      "y",
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "unchanged",
      "added",
      "removed",
      "removed",
    ]);
  });

  it("compares two empty lists to no rows at all", () => {
    expect(scopeDiffEntries([], [])).toEqual([]);
  });
});

describe("scopeDiffEntries on a hand-edited snapshot", () => {
  it("compares against the first of two lines naming one deliverable", () => {
    const entries = scopeDiffEntries(
      [
        captured("a", { estimatedMinutes: 60 }),
        captured("a", { estimatedMinutes: 600 }),
      ],
      [live("a", { estimatedMinutes: 60 })],
    );

    // Comparing against the last would make the answer depend on the order
    // the rows came back in.
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("unchanged");
  });

  it("reports a duplicated id that is gone as one removal", () => {
    const entries = scopeDiffEntries([captured("a"), captured("a")], []);

    // One deliverable, one row — otherwise every count below would double it.
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("removed");
  });
});

describe("summariseScopeDiff", () => {
  it("counts the rows of each kind", () => {
    const entries = scopeDiffEntries(
      [captured("a"), captured("b", { title: "Was" }), captured("gone")],
      [live("a"), live("b", { title: "Is" }), live("new")],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      unchangedCount: 1,
      changedCount: 1,
      addedCount: 1,
      removedCount: 1,
    });
  });

  it("reports how many lines each side held", () => {
    const entries = scopeDiffEntries(
      [captured("a"), captured("b")],
      [live("a")],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      lineCountBefore: 2,
      lineCountAfter: 1,
    });
  });

  it("totals both sides and the movement between them", () => {
    const entries = scopeDiffEntries(
      [captured("a", { estimatedMinutes: 480 })],
      [
        live("a", { estimatedMinutes: 600 }),
        live("b", { estimatedMinutes: 120 }),
      ],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      estimatedMinutesBefore: 480,
      estimatedMinutesAfter: 720,
      estimatedMinutesDelta: 240,
      estimatedHoursDelta: 4,
    });
  });

  /*
    The hours in the summary are read in one sentence beside both ends of the
    movement, so they have to be the difference of the figures that sentence
    prints. Seven minutes growing to fourteen is 0.12 hours of true movement
    and 0.11 of readable movement, and the readable one is what reconciles.
  */
  it("reads the movement as the difference of the two rounded ends", () => {
    const entries = scopeDiffEntries(
      [captured("a", { estimatedMinutes: 7 })],
      [live("a", { estimatedMinutes: 14 })],
    );
    const summary = summariseScopeDiff(entries, 0, 0);

    expect(summary).toMatchObject({
      estimatedMinutesDelta: 7,
      estimatedHoursDelta: 0.11,
    });
    expect(estimatedHours(summary.estimatedMinutesBefore)).toBe(0.12);
    expect(estimatedHours(summary.estimatedMinutesAfter)).toBe(0.23);
  });

  it("reports scope given up as a negative movement", () => {
    const entries = scopeDiffEntries(
      [
        captured("a", { estimatedMinutes: 480 }),
        captured("b", { estimatedMinutes: 120 }),
      ],
      [live("a", { estimatedMinutes: 480 })],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      estimatedMinutesDelta: -120,
      estimatedHoursDelta: -2,
    });
  });

  it("carries both contract values and the movement between them", () => {
    const summary = summariseScopeDiff([], 500_000, 650_000);

    expect(summary).toMatchObject({
      contractValueCentsBefore: 500_000,
      contractValueCentsAfter: 650_000,
      contractValueCentsDelta: 150_000,
    });
  });

  it("says nothing changed when both lists read the same", () => {
    const entries = scopeDiffEntries([captured("a")], [live("a")]);

    expect(summariseScopeDiff(entries, 500_000, 500_000)).toMatchObject({
      unchangedCount: 1,
      hasChanges: false,
    });
  });

  it("says something changed when only the price moved", () => {
    const entries = scopeDiffEntries([captured("a")], [live("a")]);

    // Untouched scope at a different price is a change, and a page counting
    // only lines would tell the reader nothing happened.
    expect(summariseScopeDiff(entries, 500_000, 400_000).hasChanges).toBe(true);
  });

  it("says something changed when only a line's status moved", () => {
    const entries = scopeDiffEntries(
      [captured("a", { status: "pending" })],
      [live("a", { status: "done" })],
    );

    expect(summariseScopeDiff(entries, 0, 0).hasChanges).toBe(true);
  });

  it("totals a hand-edited negative estimate rather than hiding it", () => {
    const entries = scopeDiffEntries(
      [captured("a", { estimatedMinutes: 60 })],
      [live("a", { estimatedMinutes: -60 })],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      estimatedMinutesAfter: -60,
      estimatedMinutesDelta: -120,
    });
  });

  it("counts a duplicated snapshot line once on both sides", () => {
    const entries = scopeDiffEntries(
      [
        captured("a", { estimatedMinutes: 60 }),
        captured("a", { estimatedMinutes: 60 }),
      ],
      [],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      removedCount: 1,
      lineCountBefore: 1,
      estimatedMinutesBefore: 60,
    });
  });
});

describe("summariseScopeDiff on a negative estimate", () => {
  it("counts no negative line on a comparison of ordinary scope", () => {
    const entries = scopeDiffEntries([captured("a")], [live("a")]);

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      negativeEstimateCountBefore: 0,
      negativeEstimateCountAfter: 0,
    });
  });

  it("counts a captured negative estimate on the side that holds it", () => {
    // Fixed since: the snapshot kept the bad row, the scope list does not.
    const entries = scopeDiffEntries(
      [captured("a", { estimatedMinutes: -120 })],
      [live("a", { estimatedMinutes: 120 })],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      negativeEstimateCountBefore: 1,
      negativeEstimateCountAfter: 0,
    });
  });

  it("counts one written since the snapshot was taken", () => {
    const entries = scopeDiffEntries(
      [captured("a")],
      [live("a"), live("b", { estimatedMinutes: -60 })],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      negativeEstimateCountBefore: 0,
      negativeEstimateCountAfter: 1,
    });
  });

  it("counts every bad line rather than flagging that there is one", () => {
    const entries = scopeDiffEntries(
      [],
      [
        live("a", { estimatedMinutes: -60 }),
        live("b", { estimatedMinutes: -90 }),
        live("c", { estimatedMinutes: 60 }),
      ],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      negativeEstimateCountAfter: 2,
    });
  });

  it("counts the line the totals cancel out, which reads as unsized", () => {
    // The case the counts exist for: both totals are zero and neither side is
    // a list nobody had estimated.
    const entries = scopeDiffEntries(
      [
        captured("a", { estimatedMinutes: -120 }),
        captured("b", { estimatedMinutes: 120 }),
      ],
      [
        live("a", { estimatedMinutes: -120 }),
        live("b", { estimatedMinutes: 120 }),
      ],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      estimatedMinutesBefore: 0,
      estimatedMinutesAfter: 0,
      negativeEstimateCountBefore: 1,
      negativeEstimateCountAfter: 1,
    });
  });

  it("counts a zero as unsized rather than as negative", () => {
    const entries = scopeDiffEntries(
      [captured("a", { estimatedMinutes: 0 })],
      [live("a", { estimatedMinutes: 0 })],
    );

    expect(summariseScopeDiff(entries, 0, 0)).toMatchObject({
      negativeEstimateCountBefore: 0,
      negativeEstimateCountAfter: 0,
    });
  });
});

describe("diffScope", () => {
  it("hands back the rows and the totals of one comparison", () => {
    const diff = diffScope(
      {
        lines: [
          captured("a", { title: "Discovery", estimatedMinutes: 480 }),
          captured("gone", { title: "Old blog import", estimatedMinutes: 120 }),
        ],
        contractValueCents: 500_000,
      },
      {
        lines: [
          live("a", { title: "Discovery", estimatedMinutes: 480 }),
          live("new", { title: "Analytics", estimatedMinutes: 240 }),
        ],
        contractValueCents: 500_000,
      },
    );

    expect(diff.entries.map((entry) => entry.kind)).toEqual([
      "unchanged",
      "added",
      "removed",
    ]);
    expect(diff.summary).toMatchObject({
      addedCount: 1,
      removedCount: 1,
      estimatedMinutesDelta: 120,
      contractValueCentsDelta: 0,
      hasChanges: true,
    });
  });

  it("summarises the rows it hands back and not the lists", () => {
    const diff = diffScope(
      { lines: [captured("a"), captured("a")], contractValueCents: 0 },
      { lines: [], contractValueCents: 0 },
    );

    expect(diff.summary.lineCountBefore).toBe(diff.entries.length);
  });

  it("compares a project that has agreed nothing either time", () => {
    const diff = diffScope(
      { lines: [], contractValueCents: 500_000 },
      { lines: [], contractValueCents: 500_000 },
    );

    expect(diff.entries).toEqual([]);
    expect(diff.summary.hasChanges).toBe(false);
  });
});

describe("movedScopeLines", () => {
  it("keeps the rows that were added, dropped or changed", () => {
    const entries = scopeDiffEntries(
      [captured("a"), captured("b", { title: "Was" }), captured("gone")],
      [live("a"), live("b", { title: "Is" }), live("new")],
    );

    expect(movedScopeLines(entries).map((entry) => entry.kind)).toEqual([
      "changed",
      "added",
      "removed",
    ]);
  });

  it("keeps them in the order the comparison read them", () => {
    const entries = scopeDiffEntries(
      [captured("a"), captured("gone")],
      [live("a"), live("new")],
    );

    expect(
      movedScopeLines(entries).map((entry) => entry.deliverableId),
    ).toEqual(["new", "gone"]);
  });

  it("keeps nothing from a comparison where nothing moved", () => {
    const entries = scopeDiffEntries([captured("a")], [live("a")]);

    expect(movedScopeLines(entries)).toEqual([]);
  });
});
