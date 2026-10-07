import { describe, expect, it } from "vitest";

import type { DeliverableStatus } from "@/lib/deliverables/status";

import { totalEstimatedMinutes, type ScopeLine } from "./scope";

/**
 * A scope line, written as the two things these functions read. Everything
 * here is whole minutes and whole cents, and the degenerate rows — zero,
 * negative, a status the list does not know — get the same attention as the
 * ordinary ones, because the column they come out of permits all of them.
 */
function line(
  estimatedMinutes: number,
  status: DeliverableStatus = "pending",
): ScopeLine {
  return { estimatedMinutes, status };
}

describe("totalEstimatedMinutes", () => {
  it("adds up the estimates on the list", () => {
    expect(totalEstimatedMinutes([line(90), line(30), line(480)])).toBe(600);
  });

  it("totals a single line as itself", () => {
    expect(totalEstimatedMinutes([line(45)])).toBe(45);
  });

  it("totals an empty scope list as nothing", () => {
    expect(totalEstimatedMinutes([])).toBe(0);
  });

  it("adds a zero as a zero rather than skipping an unsized line", () => {
    expect(totalEstimatedMinutes([line(0), line(60), line(0)])).toBe(60);
  });

  it("totals a list nobody has estimated at all as nothing", () => {
    expect(totalEstimatedMinutes([line(0), line(0)])).toBe(0);
  });

  it("carries a negative row into the total instead of clamping it", () => {
    expect(totalEstimatedMinutes([line(120), line(-30)])).toBe(90);
  });

  it("reports a total below zero when the rows add up that way", () => {
    expect(totalEstimatedMinutes([line(-30), line(-60)])).toBe(-90);
  });
});
