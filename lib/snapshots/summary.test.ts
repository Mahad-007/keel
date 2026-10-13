import { describe, expect, it } from "vitest";

import { snapshotSize } from "./summary";

describe("snapshotSize", () => {
  it("counts the lines and totals their estimates", () => {
    expect(
      snapshotSize([{ estimatedMinutes: 480 }, { estimatedMinutes: 120 }]),
    ).toEqual({ lineCount: 2, estimatedMinutes: 600, unestimatedCount: 0 });
  });

  it("counts the unsized lines the total does not speak for", () => {
    expect(
      snapshotSize([{ estimatedMinutes: 480 }, { estimatedMinutes: 0 }]),
    ).toEqual({ lineCount: 2, estimatedMinutes: 480, unestimatedCount: 1 });
  });

  it("totals a captured negative estimate rather than dropping it", () => {
    // A snapshot copies what was on the page, so a hand-edited row is in it.
    expect(
      snapshotSize([{ estimatedMinutes: 480 }, { estimatedMinutes: -60 }]),
    ).toEqual({ lineCount: 2, estimatedMinutes: 420, unestimatedCount: 0 });
  });

  it("sizes a snapshot of nothing as nothing", () => {
    expect(snapshotSize([])).toEqual({
      lineCount: 0,
      estimatedMinutes: 0,
      unestimatedCount: 0,
    });
  });
});
