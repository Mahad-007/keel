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
});
