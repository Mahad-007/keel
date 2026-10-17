import { describe, expect, it } from "vitest";

import { deliverableOptionLabel, deliverableOptions } from "./attribution";

function line(title: string, estimatedMinutes: number) {
  return { id: "dlv_1", title, estimatedMinutes };
}

describe("deliverableOptionLabel", () => {
  it("names the deliverable and what it was sized at", () => {
    expect(deliverableOptionLabel(line("Wireframes", 360))).toBe(
      "Wireframes · 6h estimated",
    );
  });

  it("writes an estimate in hours and minutes", () => {
    expect(deliverableOptionLabel(line("Revisions", 90))).toBe(
      "Revisions · 1h 30m estimated",
    );
  });

  it("writes an estimate under an hour in minutes", () => {
    expect(deliverableOptionLabel(line("Handover call", 45))).toBe(
      "Handover call · 45m estimated",
    );
  });

  it("says an unestimated line is unestimated rather than showing 0m", () => {
    // `0m` would read as a line somebody sized at nothing, which is the one
    // reading that makes a scope total lie.
    expect(deliverableOptionLabel(line("Research", 0))).toBe(
      "Research · no estimate",
    );
  });

  it("describes a line somebody hand-edited below zero", () => {
    // Not reachable through any form, and the picker still has to render it:
    // the alternative is a project whose time cannot be attributed at all.
    expect(deliverableOptionLabel(line("Broken", -60))).toBe(
      "Broken · -1h estimated",
    );
  });

  it("keeps the title as it was written", () => {
    expect(deliverableOptionLabel(line("Phase 2 · build", 60))).toBe(
      "Phase 2 · build · 1h estimated",
    );
  });
});

describe("deliverableOptions", () => {
  const SCOPE = [
    { id: "dlv_wireframes", title: "Wireframes", estimatedMinutes: 360 },
    { id: "dlv_build", title: "Build", estimatedMinutes: 0 },
    { id: "dlv_handover", title: "Handover", estimatedMinutes: 60 },
  ];

  it("offers one option per deliverable, labelled", () => {
    expect(deliverableOptions(SCOPE)).toEqual([
      { id: "dlv_wireframes", label: "Wireframes · 6h estimated" },
      { id: "dlv_build", label: "Build · no estimate" },
      { id: "dlv_handover", label: "Handover · 1h estimated" },
    ]);
  });

  it("keeps the order the scope list was read in", () => {
    // The reader has just been looking at that order on the tab next door.
    expect(deliverableOptions(SCOPE).map((option) => option.id)).toEqual([
      "dlv_wireframes",
      "dlv_build",
      "dlv_handover",
    ]);
  });

  it("offers nothing on a project with no scope agreed", () => {
    // Which leaves the "no deliverable" line as the only answer, and that is
    // the right one: there is nothing to attribute the hour to yet.
    expect(deliverableOptions([])).toEqual([]);
  });
});
