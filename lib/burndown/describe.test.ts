import { describe, expect, it } from "vitest";

import {
  BURN_DOWN_IS_WHAT_WAS_LEFT,
  describeBurnDownSpan,
  describeReconstruction,
  RECONSTRUCTED_AT_PRESENT_FIGURES,
} from "./describe";
import { burnDownReading, type BurnReading } from "./reading";

/** One day's reading of a $5,000 engagement. */
function reading(
  onDate: string,
  burnedCents = 0,
  overrides: {
    contractValueCents?: number;
    rateCents?: number;
    origin?: string;
  } = {},
): BurnReading {
  const rateCents = overrides.rateCents ?? 12_000;
  return burnDownReading({
    onDate,
    contractValueCents: overrides.contractValueCents ?? 500_000,
    rateCents,
    rateSource: rateCents === 0 ? "none" : "project",
    entryCount: 1,
    loggedMinutes: 60,
    billableMinutes: 60,
    burnedCents,
    chargeableCents: burnedCents,
    origin: overrides.origin ?? "recorded",
  });
}

describe("BURN_DOWN_IS_WHAT_WAS_LEFT", () => {
  it("names the subtraction the line is", () => {
    expect(BURN_DOWN_IS_WHAT_WAS_LEFT).toContain("contract value less");
  });

  it("says the line starts at the first logged day, not the agreement", () => {
    expect(BURN_DOWN_IS_WHAT_WAS_LEFT).toContain("first day time was logged");
  });
});

describe("describeBurnDownSpan", () => {
  it("counts the readings and names the days they run between", () => {
    expect(
      describeBurnDownSpan([
        reading("2026-03-01"),
        reading("2026-03-16"),
        reading("2026-03-31"),
      ]),
    ).toBe("3 readings, Mar 1 – 31, 2026.");
  });

  it("writes a single reading as the one day it is", () => {
    expect(describeBurnDownSpan([reading("2026-03-01")])).toBe(
      "One reading, on Mar 1, 2026.",
    );
  });

  it("spells out both years of a span that crosses one", () => {
    expect(
      describeBurnDownSpan([reading("2026-12-28"), reading("2027-01-03")]),
    ).toBe("2 readings, Dec 28, 2026 – Jan 3, 2027.");
  });

  it("has nothing to say about a project with no readings", () => {
    expect(describeBurnDownSpan([])).toBeNull();
  });
});

describe("describeReconstruction", () => {
  it("says nothing about a line that was measured throughout", () => {
    expect(
      describeReconstruction([reading("2026-03-01"), reading("2026-03-31")]),
    ).toBeNull();
  });

  it("names the days of the one stretch that was reconstructed", () => {
    const caveat = describeReconstruction([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-16", 0, { origin: "backfilled" }),
      reading("2026-03-31"),
    ]);
    expect(caveat).toContain("The shaded stretch, Mar 1 – 16, 2026,");
    expect(caveat).toContain("reconstructed after the fact");
  });

  it("says so plainly when the whole line is a reconstruction", () => {
    const caveat = describeReconstruction([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-31", 0, { origin: "backfilled" }),
    ]);
    expect(caveat).toContain("Every reading on this chart");
    expect(caveat).not.toContain("shaded");
  });

  it("counts the stretches when a gap was repaired later", () => {
    const caveat = describeReconstruction([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-09"),
      reading("2026-03-16", 0, { origin: "backfilled" }),
      reading("2026-03-31"),
    ]);
    expect(caveat).toContain("The 2 shaded stretches were");
  });

  it("always explains what a reconstruction cannot know", () => {
    const lines = [
      [reading("2026-03-01", 0, { origin: "backfilled" })],
      [
        reading("2026-03-01", 0, { origin: "backfilled" }),
        reading("2026-03-31"),
      ],
      [
        reading("2026-03-01", 0, { origin: "backfilled" }),
        reading("2026-03-09"),
        reading("2026-03-16", 0, { origin: "backfilled" }),
      ],
    ];
    for (const line of lines) {
      expect(describeReconstruction(line)).toContain(
        RECONSTRUCTED_AT_PRESENT_FIGURES,
      );
    }
  });

  it("does not cast doubt on the hours themselves", () => {
    expect(RECONSTRUCTED_AT_PRESENT_FIGURES).toContain(
      "The hours are the hours that were logged",
    );
  });

  it("says nothing about a project with no readings", () => {
    expect(describeReconstruction([])).toBeNull();
  });
});
