import { describe, expect, it } from "vitest";

import {
  PROJECTION_CAVEATS,
  PROJECTION_CONFIDENCE,
} from "@/lib/projection/confidence";

import {
  CAVEAT_SENTENCE,
  contractRunsOutFigure,
  CONFIDENCE_LABEL,
  CONFIDENCE_LEAD,
  BEYOND_HORIZON_LABEL,
  CONTRACT_ALREADY_GONE_LABEL,
  describeForecastDate,
  describePaceBasis,
  describeProjectedRemaining,
  paceFigure,
  projectedContractFigure,
  projectedCostFigure,
  projectedShareFigure,
  projectionCaveatSentences,
  projectionFigures,
  workPaidForFigure,
  formatPace,
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
      contractedCents: 1_000_000,
      burnedCents: 400_000,
      remainingWorkCents: 240_000,
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

describe("formatPace", () => {
  it("says the pace as money a day", () => {
    expect(formatPace(85_714)).toBe("$857.14 a day");
  });

  it("rounds to the cent for display only", () => {
    expect(formatPace(400_000 / 59)).toBe("$67.80 a day");
  });

  it("says a pace of nothing as nothing a day", () => {
    expect(formatPace(0)).toBe("$0.00 a day");
  });
});

describe("describePaceBasis", () => {
  it("names the span, the end and the number of readings", () => {
    expect(describePaceBasis(projection().pace)).toBe(
      "Measured across 14 days to Mar 14, 2026, from 8 readings.",
    );
  });

  it("says one day and one reading in the singular", () => {
    expect(
      describePaceBasis({
        ...projection().pace,
        elapsedDays: 1,
        readingCount: 1,
      }),
    ).toBe("Measured across one day to Mar 14, 2026, from one reading.");
  });

  it("says nothing about whether the basis is enough", () => {
    // That is the caveats' job, and a reader should not meet it twice.
    const basis = describePaceBasis({
      ...projection().pace,
      elapsedDays: 2,
      readingCount: 2,
    });
    expect(basis).not.toContain("too");
    expect(basis).not.toContain("short");
  });
});

describe("CAVEAT_SENTENCE", () => {
  it("has words for every caveat the list declares", () => {
    for (const caveat of PROJECTION_CAVEATS) {
      expect(CAVEAT_SENTENCE[caveat](projection()).length).toBeGreaterThan(0);
    }
  });

  it("puts the span in the short-history sentence", () => {
    const sentence = CAVEAT_SENTENCE["short-history"](
      projection({
        evidence: { ...projection().evidence, paceDays: 3 },
      }),
    );
    expect(sentence).toContain("3 days");
  });

  it("says a single day of readings in the singular", () => {
    expect(
      CAVEAT_SENTENCE["short-history"](
        projection({ evidence: { ...projection().evidence, paceDays: 1 } }),
      ),
    ).toContain("a single day");
  });

  it("calls one reading a point rather than a slope", () => {
    expect(
      CAVEAT_SENTENCE["few-readings"](
        projection({ evidence: { ...projection().evidence, readingCount: 1 } }),
      ),
    ).toContain("a point rather than a slope");
  });

  it("names both paces and which way the dates would move", () => {
    const sentence = CAVEAT_SENTENCE["pace-changed"](
      projection({
        evidence: { ...projection().evidence, paceShift: "faster" },
      }),
    );
    // $1,200.00 over a fortnight against $4,000.00 over fifty-nine days.
    expect(sentence).toContain("$85.71 a day");
    expect(sentence).toContain("$67.80 a day");
    expect(sentence).toContain("later");
  });

  it("says the dates would come sooner when the project has slowed", () => {
    const sentence = CAVEAT_SENTENCE["pace-changed"](
      projection({
        evidence: { ...projection().evidence, paceShift: "slower" },
      }),
    );
    expect(sentence).toContain("sooner");
  });

  it("counts the reconstructed readings against the whole pace", () => {
    const sentence = CAVEAT_SENTENCE["reconstructed-history"](
      projection({
        evidence: { ...projection().evidence, reconstructedCount: 3 },
      }),
    );
    expect(sentence).toContain("3 of the 8 readings");
  });

  it("says how many days the readings have been quiet for", () => {
    expect(
      CAVEAT_SENTENCE["stale-readings"](
        projection({
          evidence: { ...projection().evidence, daysSinceLastReading: 11 },
        }),
      ),
    ).toContain("11 days");
  });

  it("says the expected cost is a floor when scope is unsized", () => {
    const sentence = CAVEAT_SENTENCE["unsized-scope"](
      projection({
        evidence: { ...projection().evidence, unsizedUndeliveredCount: 2 },
      }),
    );
    expect(sentence).toContain("2 unfinished deliverables carry");
    expect(sentence).toContain("floor");
  });

  it("says one unfinished deliverable in the singular", () => {
    expect(
      CAVEAT_SENTENCE["unsized-scope"](
        projection({
          evidence: { ...projection().evidence, unsizedUndeliveredCount: 1 },
        }),
      ),
    ).toContain("One unfinished deliverable carries");
  });

  it("says what is withheld when there is no scope list", () => {
    expect(CAVEAT_SENTENCE["no-scope"](projection())).toContain(
      "when the money runs out, not when the project ends",
    );
  });
});

describe("projectionCaveatSentences", () => {
  it("says nothing at all for a projection with no caveats", () => {
    expect(projectionCaveatSentences(projection())).toEqual([]);
  });

  it("keeps the order the caveats were reported in", () => {
    const sentences = projectionCaveatSentences(
      projection({ caveats: ["short-history", "unsized-scope"] }),
    );
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("days of readings");
    expect(sentences[1]).toContain("floor");
  });
});

describe("describeProjectedRemaining", () => {
  it("says what is left when the project lands inside its price", () => {
    expect(describeProjectedRemaining(projection().forecast)).toBe(
      "$3,600.00 left",
    );
  });

  it("flips the sign and says over when it does not", () => {
    expect(
      describeProjectedRemaining({
        ...projection().forecast,
        projectedRemainingCents: -400_000,
      }),
    ).toBe("$4,000.00 over");
  });

  it("reads a project landing exactly on its price as nothing left", () => {
    expect(
      describeProjectedRemaining({
        ...projection().forecast,
        projectedRemainingCents: 0,
      }),
    ).toBe("$0.00 left");
  });
});

describe("describeForecastDate", () => {
  it("formats the day when there is one", () => {
    expect(describeForecastDate(70, "2026-05-23")).toBe("May 23, 2026");
  });

  it("says the money is gone when there are no days left to count", () => {
    expect(describeForecastDate(null, null)).toBe(CONTRACT_ALREADY_GONE_LABEL);
  });

  it("says a day past the horizon is out of range, not absent", () => {
    // The arithmetic ran and the count is enormous, which is a different
    // fact from the question not applying.
    expect(describeForecastDate(40_000, null)).toBe(BEYOND_HORIZON_LABEL);
  });
});

describe("projectedCostFigure", () => {
  it("shows the total and breaks it into its two halves", () => {
    const figure = projectedCostFigure(projection());
    expect(figure.value).toBe("$6,400.00");
    expect(figure.note).toContain("$4,000.00 of hours already logged");
    expect(figure.note).toContain("$2,400.00 of unfinished estimates");
  });
});

describe("projectedContractFigure", () => {
  it("names the price a project landing inside it was measured against", () => {
    const figure = projectedContractFigure(projection());
    expect(figure.value).toBe("$3,600.00 left");
    expect(figure.note).toBe("Of the $10,000.00 agreed, on this projection.");
  });

  it("says what an overage means in practice", () => {
    const figure = projectedContractFigure(
      projection({
        forecast: {
          ...projection().forecast,
          projectedOverageCents: 400_000,
          projectedRemainingCents: -400_000,
        },
      }),
    );
    expect(figure.value).toBe("$4,000.00 over");
    expect(figure.note).toContain("nobody is paying for");
  });
});

describe("projectedShareFigure", () => {
  it("shows the projected share and what has gone already", () => {
    const figure = projectedShareFigure(projection());
    expect(figure.value).toBe("64%");
    expect(figure.note).toContain("$4,000.00 of the $10,000.00 agreed");
  });

  it("leaves a projection past the contract unclamped", () => {
    expect(
      projectedShareFigure(
        projection({
          forecast: { ...projection().forecast, projectedShare: 1.68 },
        }),
      ).value,
    ).toBe("168%");
  });

  it("stands in for a share there is no price to take", () => {
    expect(
      projectedShareFigure(
        projection({
          forecast: { ...projection().forecast, projectedShare: null },
        }),
      ).value,
    ).toBe("No price set");
  });
});

describe("contractRunsOutFigure", () => {
  it("dates the end of the money and says how far off it is", () => {
    const figure = contractRunsOutFigure(projection());
    expect(figure.value).toBe("May 23, 2026");
    expect(figure.note).toBe("70 days of contract left at this pace.");
  });

  it("says there is no day left to count to once the money has gone", () => {
    const figure = contractRunsOutFigure(
      projection({
        forecast: {
          ...projection().forecast,
          daysOfContractLeft: null,
          contractRunsOutOn: null,
        },
      }),
    );
    expect(figure.value).toBe("Already gone");
    expect(figure.note).toContain("already passed the contract value");
  });

  it("says one day in the singular", () => {
    expect(
      contractRunsOutFigure(
        projection({
          forecast: { ...projection().forecast, daysOfContractLeft: 1 },
        }),
      ).note,
    ).toBe("One day of contract left at this pace.");
  });
});

describe("workPaidForFigure", () => {
  it("dates the end of the work and says what is left to pay for", () => {
    const figure = workPaidForFigure(projection());
    expect(figure.value).toBe("Apr 11, 2026");
    expect(figure.note).toBe(
      "$2,400.00 of estimates left, which is 28 days at this pace.",
    );
  });

  it("does not claim to know when anything will be delivered", () => {
    // The forecast knows what the estimates come to, not what anybody plans.
    expect(workPaidForFigure(projection()).label).not.toContain("Finish");
  });
});

describe("paceFigure", () => {
  it("shows the pace and how it was measured", () => {
    const figure = paceFigure(projection());
    expect(figure.value).toBe("$85.71 a day");
    expect(figure.note).toContain("Measured across 14 days");
  });
});

describe("projectionFigures", () => {
  it("puts the conclusions before the working", () => {
    expect(projectionFigures(projection()).map((row) => row.label)).toEqual([
      "Expected to cost",
      "Against the contract",
      "Projected consumption",
      "Contract runs out",
      "Remaining work paid for",
      "Burn rate",
    ]);
  });

  it("drops the cost rows when there is no scope list to project from", () => {
    // They would read as a project expecting no overage, which is the one
    // figure here that would be wrong in the reassuring direction.
    expect(
      projectionFigures(projection({ caveats: ["no-scope"] })).map(
        (row) => row.label,
      ),
    ).toEqual(["Contract runs out", "Remaining work paid for", "Burn rate"]);
  });

  it("gives every row a label, a value and a note", () => {
    for (const row of projectionFigures(projection())) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.value.length).toBeGreaterThan(0);
      expect(row.note).not.toBeNull();
    }
  });
});
