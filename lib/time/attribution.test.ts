import { describe, expect, it } from "vitest";

import { deliverableOptionLabel } from "./attribution";

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
