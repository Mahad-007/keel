import { describe, expect, it } from "vitest";

import {
  CAVEAT_CONFIDENCE,
  MEASURABLE_PACE_DAYS,
  MEASURABLE_PACE_READINGS,
  type ProjectionEvidence,
  projectionCaveats,
  confidenceSeverity,
  PROJECTION_CAVEATS,
  projectionConfidence,
  PROJECTION_CONFIDENCE,
  worstConfidence,
} from "./confidence";

describe("confidenceSeverity", () => {
  it("ranks the grades worst last", () => {
    expect(confidenceSeverity("firm")).toBeLessThan(
      confidenceSeverity("indicative"),
    );
    expect(confidenceSeverity("indicative")).toBeLessThan(
      confidenceSeverity("weak"),
    );
  });

  it("ranks every grade the list declares", () => {
    for (const confidence of PROJECTION_CONFIDENCE) {
      expect(confidenceSeverity(confidence)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("worstConfidence", () => {
  it("takes the worse of two grades", () => {
    expect(worstConfidence("firm", "weak")).toBe("weak");
    expect(worstConfidence("weak", "firm")).toBe("weak");
    expect(worstConfidence("firm", "indicative")).toBe("indicative");
  });

  it("leaves a pair of equal grades alone", () => {
    expect(worstConfidence("indicative", "indicative")).toBe("indicative");
  });

  it("does not average: one weak input makes the whole thing weak", () => {
    const graded = (["firm", "firm", "firm", "weak"] as const).reduce(
      worstConfidence,
      "firm" as const,
    );
    expect(graded).toBe("weak");
  });

  it("is the same answer whichever order the pair arrives in", () => {
    for (const a of PROJECTION_CONFIDENCE) {
      for (const b of PROJECTION_CONFIDENCE) {
        expect(worstConfidence(a, b)).toBe(worstConfidence(b, a));
      }
    }
  });
});

describe("CAVEAT_CONFIDENCE", () => {
  it("grades every caveat the list declares", () => {
    for (const caveat of PROJECTION_CAVEATS) {
      expect(PROJECTION_CONFIDENCE).toContain(CAVEAT_CONFIDENCE[caveat]);
    }
  });

  it("never grades a caveat firm", () => {
    // A caveat that cost the forecast nothing would be a sentence with no
    // consequence, and a reader would learn to skip the list.
    for (const caveat of PROJECTION_CAVEATS) {
      expect(CAVEAT_CONFIDENCE[caveat]).not.toBe("firm");
    }
  });

  it("grades the caveats that undermine the basis weak", () => {
    expect(CAVEAT_CONFIDENCE["short-history"]).toBe("weak");
    expect(CAVEAT_CONFIDENCE["few-readings"]).toBe("weak");
    expect(CAVEAT_CONFIDENCE["no-scope"]).toBe("weak");
  });
});

describe("projectionConfidence", () => {
  it("is firm when nothing is wrong with the inputs", () => {
    expect(projectionConfidence([])).toBe("firm");
  });

  it("takes the worst of several caveats", () => {
    expect(
      projectionConfidence(["reconstructed-history", "short-history"]),
    ).toBe("weak");
  });

  it("is unmoved by how many caveats of the same grade there are", () => {
    // Three approximations do not add up to no basis at all.
    expect(
      projectionConfidence([
        "reconstructed-history",
        "stale-readings",
        "unsized-scope",
        "pace-changed",
      ]),
    ).toBe("indicative");
  });

  it("does not let clean inputs offset a weak one", () => {
    expect(projectionConfidence(["no-scope"])).toBe("weak");
  });

  it("grades a single caveat as that caveat's own grade", () => {
    for (const caveat of PROJECTION_CAVEATS) {
      expect(projectionConfidence([caveat])).toBe(CAVEAT_CONFIDENCE[caveat]);
    }
  });
});

/**
 * A project with nothing wrong with its forecast: two months of measured
 * readings, a steady pace, and every unfinished line sized.
 */
function evidence(
  overrides: Partial<ProjectionEvidence> = {},
): ProjectionEvidence {
  return {
    paceDays: 59,
    readingCount: 30,
    reconstructedCount: 0,
    daysSinceLastReading: 0,
    paceShift: "steady",
    wholeHistoryWindow: false,
    lineCount: 6,
    unsizedUndeliveredCount: 0,
    ...overrides,
  };
}

describe("projectionCaveats", () => {
  it("finds nothing wrong with a well-measured project", () => {
    expect(projectionCaveats(evidence())).toEqual([]);
  });

  it("caveats a pace measured over fewer days than a week", () => {
    expect(projectionCaveats(evidence({ paceDays: 3 }))).toContain(
      "short-history",
    );
  });

  it("accepts a pace measured over exactly a week", () => {
    expect(
      projectionCaveats(evidence({ paceDays: MEASURABLE_PACE_DAYS })),
    ).not.toContain("short-history");
  });

  it("caveats a pace measured from fewer than three readings", () => {
    // A straight line between two points is not evidence of a trend.
    expect(projectionCaveats(evidence({ readingCount: 2 }))).toContain(
      "few-readings",
    );
  });

  it("accepts a pace measured from exactly three readings", () => {
    expect(
      projectionCaveats(evidence({ readingCount: MEASURABLE_PACE_READINGS })),
    ).not.toContain("few-readings");
  });

  it("reports a short and a sparse history as two separate caveats", () => {
    // A reader told only about the span would wait a week for a problem the
    // snapshot writes would have fixed.
    expect(
      projectionCaveats(evidence({ paceDays: 2, readingCount: 2 })),
    ).toEqual(["short-history", "few-readings"]);
  });

  it("grades a short history weak", () => {
    expect(
      projectionConfidence(projectionCaveats(evidence({ paceDays: 2 }))),
    ).toBe("weak");
  });
});

describe("projectionCaveats: the recent window", () => {
  it("caveats a pace the recent window cannot corroborate", () => {
    expect(
      projectionCaveats(evidence({ paceDays: 10, wholeHistoryWindow: true })),
    ).toContain("no-window");
  });

  it("says nothing about the window once there is history outside it", () => {
    expect(
      projectionCaveats(evidence({ wholeHistoryWindow: false })),
    ).not.toContain("no-window");
  });

  it("does not say it twice to a project too young to measure", () => {
    // Already told its history is three days; a second sentence about the
    // window it fits inside gives it nothing further to do.
    const caveats = projectionCaveats(
      evidence({ paceDays: 3, wholeHistoryWindow: true }),
    );
    expect(caveats).toContain("short-history");
    expect(caveats).not.toContain("no-window");
  });

  it("grades a pace with no corroboration indicative, not weak", () => {
    // The pace is real and measured over a fortnight. It is just the only
    // reading there is.
    expect(
      projectionConfidence(
        projectionCaveats(evidence({ paceDays: 14, wholeHistoryWindow: true })),
      ),
    ).toBe("indicative");
  });
});
