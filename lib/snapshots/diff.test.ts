import { describe, expect, it } from "vitest";

import { scopeFieldChanges, type ComparableScopeLine } from "./diff";

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
