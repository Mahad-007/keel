import { describe, expect, it } from "vitest";

import { PROJECTION_CONFIDENCE } from "@/lib/projection/confidence";

import {
  CONFIDENCE_LABEL,
  CONFIDENCE_LEAD,
  hasProjectedCost,
} from "./projected-completion";
import type { ProjectProjection } from "./projection";

/** A projection with only the fields a words function reads. */
function projection(
  overrides: Partial<ProjectProjection> = {},
): ProjectProjection {
  return {
    pace: {
      fromDate: "2026-03-01",
      toDate: "2026-03-14",
      elapsedDays: 14,
      burnedCents: 120_000,
      centsPerDay: 120_000 / 14,
      readingCount: 8,
    },
    overallPace: {
      fromDate: "2026-01-15",
      toDate: "2026-03-14",
      elapsedDays: 59,
      burnedCents: 400_000,
      centsPerDay: 400_000 / 59,
      readingCount: 20,
    },
    recentPace: null,
    evidence: {
      paceDays: 14,
      readingCount: 8,
      reconstructedCount: 0,
      daysSinceLastReading: 0,
      paceShift: "steady",
      wholeHistoryWindow: false,
      lineCount: 5,
      unsizedUndeliveredCount: 0,
    },
    forecast: {
      projectedFinalCents: 640_000,
      projectedOverageCents: 0,
      projectedRemainingCents: 360_000,
      projectedShare: 0.64,
      daysOfWorkLeft: 28,
      workPaidForOn: "2026-04-11",
      daysOfContractLeft: 70,
      contractRunsOutOn: "2026-05-23",
    },
    caveats: [],
    confidence: "firm",
    ...overrides,
  };
}

describe("hasProjectedCost", () => {
  it("is true for a project with a scope list", () => {
    expect(hasProjectedCost(projection())).toBe(true);
  });

  it("is false when there is no scope list to project from", () => {
    expect(hasProjectedCost(projection({ caveats: ["no-scope"] }))).toBe(false);
  });

  it("is unmoved by the other caveats", () => {
    expect(
      hasProjectedCost(
        projection({ caveats: ["short-history", "unsized-scope"] }),
      ),
    ).toBe(true);
  });
});

describe("CONFIDENCE_LABEL", () => {
  it("labels every grade", () => {
    for (const grade of PROJECTION_CONFIDENCE) {
      expect(CONFIDENCE_LABEL[grade].length).toBeGreaterThan(0);
    }
  });

  it("gives the three grades three different labels", () => {
    expect(new Set(Object.values(CONFIDENCE_LABEL)).size).toBe(
      PROJECTION_CONFIDENCE.length,
    );
  });
});

describe("CONFIDENCE_LEAD", () => {
  it("has a sentence for every grade", () => {
    for (const grade of PROJECTION_CONFIDENCE) {
      expect(CONFIDENCE_LEAD[grade].length).toBeGreaterThan(0);
    }
  });

  it("calls the figures an extrapolation even at the best grade", () => {
    // A panel that dropped the qualifier for its tidiest projects would be at
    // its most confident where it had least right to be.
    expect(CONFIDENCE_LEAD.firm).toContain("extrapolation");
  });

  it("says a weak basis is not a figure to quote", () => {
    expect(CONFIDENCE_LEAD.weak).toContain("not a figure to quote");
  });
});
