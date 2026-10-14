import { describe, expect, it } from "vitest";

import { snapshotSize, snapshotSizeLabel, snapshotTakenLabel } from "./summary";

describe("snapshotSize", () => {
  it("counts the lines and totals their estimates", () => {
    expect(
      snapshotSize([{ estimatedMinutes: 480 }, { estimatedMinutes: 120 }]),
    ).toEqual({
      lineCount: 2,
      estimatedMinutes: 600,
      unestimatedCount: 0,
      negativeEstimateCount: 0,
    });
  });

  it("counts the unsized lines the total does not speak for", () => {
    expect(
      snapshotSize([{ estimatedMinutes: 480 }, { estimatedMinutes: 0 }]),
    ).toEqual({
      lineCount: 2,
      estimatedMinutes: 480,
      unestimatedCount: 1,
      negativeEstimateCount: 0,
    });
  });

  it("totals a captured negative estimate rather than dropping it", () => {
    // A snapshot copies what was on the page, so a hand-edited row is in it.
    expect(
      snapshotSize([{ estimatedMinutes: 480 }, { estimatedMinutes: -60 }]),
    ).toEqual({
      lineCount: 2,
      estimatedMinutes: 420,
      unestimatedCount: 0,
      negativeEstimateCount: 1,
    });
  });

  it("sizes a snapshot of nothing as nothing", () => {
    expect(snapshotSize([])).toEqual({
      lineCount: 0,
      estimatedMinutes: 0,
      unestimatedCount: 0,
      negativeEstimateCount: 0,
    });
  });
});

describe("snapshotSizeLabel", () => {
  it("leads with the count and follows with the total", () => {
    expect(
      snapshotSizeLabel({
        lineCount: 4,
        estimatedMinutes: 2_880,
        unestimatedCount: 0,
        negativeEstimateCount: 0,
      }),
    ).toBe("4 deliverables, 48h");
  });

  it("agrees the noun with a list of one", () => {
    expect(
      snapshotSizeLabel({
        lineCount: 1,
        estimatedMinutes: 480,
        unestimatedCount: 0,
        negativeEstimateCount: 0,
      }),
    ).toBe("1 deliverable, 8h");
  });

  it("says how many lines the total does not speak for", () => {
    expect(
      snapshotSizeLabel({
        lineCount: 4,
        estimatedMinutes: 2_400,
        unestimatedCount: 1,
        negativeEstimateCount: 0,
      }),
    ).toBe("4 deliverables, 40h, 1 not estimated");
  });

  it("refuses to claim a total for a list nobody sized", () => {
    expect(
      snapshotSizeLabel({
        lineCount: 3,
        estimatedMinutes: 0,
        unestimatedCount: 3,
        negativeEstimateCount: 0,
      }),
    ).toBe("3 deliverables, none estimated");
  });

  it("describes a snapshot of nothing, which only a hand-written row is", () => {
    expect(
      snapshotSizeLabel({
        lineCount: 0,
        estimatedMinutes: 0,
        unestimatedCount: 0,
        negativeEstimateCount: 0,
      }),
    ).toBe("nothing agreed");
  });
});

describe("snapshotTakenLabel", () => {
  it("leads with what the moment was called", () => {
    expect(
      snapshotTakenLabel({
        label: "Signed proposal",
        capturedAt: "2026-10-13T09:36:00.000Z",
      }),
    ).toBe("Signed proposal · Oct 13, 2026");
  });

  it("falls back to the date when nobody named it", () => {
    expect(
      snapshotTakenLabel({
        label: null,
        capturedAt: "2026-03-01T23:00:00.000Z",
      }),
    ).toBe("Mar 1, 2026");
  });

  it("reads the date off the string rather than through a clock", () => {
    // A row written at 23:00 UTC must not read as the previous day.
    expect(
      snapshotTakenLabel({ label: null, capturedAt: "2026-03-01 23:00:00" }),
    ).toBe("Mar 1, 2026");
  });
});
