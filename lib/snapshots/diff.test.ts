import { describe, expect, it } from "vitest";

import type { CapturedScopeLine, SnapshotLineDraft } from "./capture";
import {
  scopeDiffEntries,
  scopeFieldChanges,
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
    expect(scopeFieldChanges(LINE, { ...LINE, title: "Discovery phase" })).toEqual(
      [{ field: "title", before: "Discovery", after: "Discovery phase" }],
    );
  });

  it("reports an estimate that moved, in minutes", () => {
    expect(
      scopeFieldChanges(LINE, { ...LINE, estimatedMinutes: 960 }),
    ).toEqual([{ field: "estimate", before: 480, after: 960 }]);
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
    expect(
      scopeFieldChanges({ ...LINE, description: null }, LINE),
    ).toEqual([
      { field: "description", before: null, after: "Two workshops." },
    ]);
  });

  it("reports a description that was taken away", () => {
    expect(
      scopeFieldChanges(LINE, { ...LINE, description: null }),
    ).toEqual([
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
    expect(
      scopeFieldChanges({ ...LINE, status: "blocked" }, LINE),
    ).toEqual([{ field: "status", before: "blocked", after: "pending" }]);
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
    const line = captured("a", { title: "Migrate the old posts", estimatedMinutes: 360 });
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
