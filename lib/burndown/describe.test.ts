import { describe, expect, it } from "vitest";

import {
  BURN_DOWN_IS_WHAT_WAS_LEFT,
  describeBurnDownSpan,
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
