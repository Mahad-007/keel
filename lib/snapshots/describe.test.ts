import { describe, expect, it } from "vitest";

import { describeFieldChange, SCOPE_CHANGE_LABELS } from "./describe";
import { SCOPE_CHANGE_KINDS } from "./diff";

describe("SCOPE_CHANGE_LABELS", () => {
  it("has a word for every kind a comparison can report", () => {
    for (const kind of SCOPE_CHANGE_KINDS) {
      expect(SCOPE_CHANGE_LABELS[kind]).not.toBe("");
    }
  });
});

describe("describeFieldChange", () => {
  it("names both titles of a retitled line", () => {
    expect(
      describeFieldChange({
        field: "title",
        before: "Discovery",
        after: "Discovery phase",
      }),
    ).toBe("Retitled from “Discovery” to “Discovery phase”.");
  });

  it("reads an estimate that went up", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 480, after: 960 }),
    ).toBe("Estimate up from 8h to 16h.");
  });

  it("reads an estimate that came down", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 960, after: 480 }),
    ).toBe("Estimate down from 16h to 8h.");
  });

  it("reads a line that was finally sized rather than one that grew", () => {
    // A zero is a missing number, not an estimate of nothing.
    expect(
      describeFieldChange({ field: "estimate", before: 0, after: 120 }),
    ).toBe("Estimated at 2h, having had no estimate before.");
  });

  it("reads a line that lost its estimate rather than one that shrank", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 120, after: 0 }),
    ).toBe("Estimate of 2h taken off, leaving the line unsized.");
  });

  it("reads a status move in the words the list uses", () => {
    expect(
      describeFieldChange({ field: "status", before: "pending", after: "done" }),
    ).toBe("Status moved from Not started to Done.");
  });

  it("reads a status the app does not recognise as whatever is stored", () => {
    expect(
      describeFieldChange({
        field: "status",
        before: "blocked",
        after: "started",
      }),
    ).toBe("Status moved from blocked to In progress.");
  });

  it("says detail was added without quoting the paragraph", () => {
    expect(
      describeFieldChange({
        field: "description",
        before: null,
        after: "Two workshops.",
      }),
    ).toBe("Detail added.");
  });

  it("says detail was taken off", () => {
    expect(
      describeFieldChange({
        field: "description",
        before: "Two workshops.",
        after: null,
      }),
    ).toBe("Detail taken off.");
  });

  it("says detail was reworded when both sides have words", () => {
    expect(
      describeFieldChange({
        field: "description",
        before: "Two workshops.",
        after: "Three workshops.",
      }),
    ).toBe("Detail reworded.");
  });

  it("reads a hand-edited negative estimate rather than refusing to", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 480, after: -60 }),
    ).toBe("Estimate down from 8h to -1h.");
  });
});
