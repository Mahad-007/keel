import { describe, expect, it } from "vitest";

import {
  describeEstimate,
  UNESTIMATED_LABEL,
} from "@/lib/deliverables/list";
import type { DeliverableStatus } from "@/lib/deliverables/status";

import {
  totalEstimatedMinutes,
  unestimatedCount,
  type ScopeLine,
} from "./scope";

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

describe("unestimatedCount", () => {
  it("counts the lines sitting at zero", () => {
    expect(unestimatedCount([line(0), line(60), line(0)])).toBe(2);
  });

  it("counts nothing when every line has been sized", () => {
    expect(unestimatedCount([line(60), line(90)])).toBe(0);
  });

  it("counts every line of a list nobody has estimated", () => {
    expect(unestimatedCount([line(0), line(0), line(0)])).toBe(3);
  });

  it("counts nothing on an empty scope list", () => {
    expect(unestimatedCount([])).toBe(0);
  });

  it("treats a negative row as estimated, badly, rather than missing", () => {
    expect(unestimatedCount([line(-30)])).toBe(0);
  });

  it("agrees with the words the scope list puts on each line", () => {
    for (const minutes of [0, 1, 90, -30]) {
      expect(unestimatedCount([line(minutes)])).toBe(
        describeEstimate(minutes) === UNESTIMATED_LABEL ? 1 : 0,
      );
    }
  });
});
