import { describe, expect, it } from "vitest";

import type { BurnReading } from "@/lib/burndown/reading";

import { centsPerDay, hasBurnRate, overallBurnRate } from "./rate";

/**
 * A stored reading, as the chart gets it.
 *
 * `burnedCents` is the cumulative total at the end of the day, which is what
 * the rate arithmetic reads; the rest is carried so the literal satisfies the
 * type without every test having to care about it.
 */
function reading(
  onDate: string,
  burnedCents: number,
  overrides: Partial<BurnReading> = {},
): BurnReading {
  return {
    onDate,
    contractedCents: 1_000_000,
    rate: { cents: 12_000, source: "project" },
    entryCount: 1,
    loggedMinutes: Math.round((burnedCents * 60) / 12_000),
    billableMinutes: Math.round((burnedCents * 60) / 12_000),
    burnedCents,
    chargeableCents: burnedCents,
    remainingCents: 1_000_000 - burnedCents,
    consumedShare: burnedCents / 1_000_000,
    origin: "recorded",
    ...overrides,
  };
}

describe("centsPerDay", () => {
  it("divides the burn over the days it took", () => {
    expect(centsPerDay(70_000, 7)).toBe(10_000);
  });

  it("is the whole burn for a span of one day", () => {
    expect(centsPerDay(12_000, 1)).toBe(12_000);
  });

  it("leaves the quotient unrounded", () => {
    // A ratio, not an amount: rounding here and multiplying by ninety days
    // downstream would compound a half-cent into real money.
    expect(centsPerDay(10_000, 3)).toBeCloseTo(3333.333, 3);
  });

  it("reports no pace for a span of no days", () => {
    expect(centsPerDay(70_000, 0)).toBeNull();
  });

  it("reports no pace for a span measured backwards", () => {
    expect(centsPerDay(70_000, -2)).toBeNull();
  });

  it("is nought for a span nothing was burned across", () => {
    // A measurement, not a gap: these days happened and nobody worked.
    expect(centsPerDay(0, 14)).toBe(0);
  });

  it("carries a burn that went backwards through as a negative pace", () => {
    // An entry deleted between two readings. Visible rather than clamped —
    // a project whose burn fell is a fact, not a project that stood still.
    expect(centsPerDay(-14_000, 7)).toBe(-2000);
  });
});

describe("overallBurnRate", () => {
  it("divides the cumulative burn by the days it was spread over", () => {
    // Four days, both ends counted, and $400.00 burned across them.
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-04", 40_000),
    ]);
    expect(rate).toMatchObject({
      fromDate: "2026-03-01",
      toDate: "2026-03-04",
      elapsedDays: 4,
      burnedCents: 40_000,
      centsPerDay: 10_000,
      readingCount: 2,
    });
  });

  it("baselines at nought rather than at the first reading", () => {
    // The first reading already holds the first day's work. Subtracting it
    // would report $300.00 over four days instead of $400.00.
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-04", 40_000),
    ]);
    expect(rate?.burnedCents).toBe(40_000);
  });

  it("reads a single reading as one day at its own figure", () => {
    const rate = overallBurnRate([reading("2026-03-01", 12_000)]);
    expect(rate).toMatchObject({
      fromDate: "2026-03-01",
      toDate: "2026-03-01",
      elapsedDays: 1,
      centsPerDay: 12_000,
      readingCount: 1,
    });
  });

  it("counts the idle days between readings, not just the ones with rows", () => {
    // Worked on the first and the thirty-first and not in between: the pace
    // is spread across the whole month, because the money was.
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-31", 40_000),
    ]);
    expect(rate?.elapsedDays).toBe(31);
    expect(rate?.centsPerDay).toBeCloseTo(1290.32, 2);
  });

  it("counts every reading it was handed, not just the ends", () => {
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-02", 20_000),
      reading("2026-03-03", 30_000),
    ]);
    expect(rate?.readingCount).toBe(3);
  });

  it("reports no pace at all for a project with no readings", () => {
    // No pace, as opposed to a pace of nothing: a forecast from nought would
    // promise the contract lasts for ever.
    expect(overallBurnRate([])).toBeNull();
  });

  it("reports a pace of nothing when nothing has been burned", () => {
    // Days with readings and no money against them. A measurement, so the
    // rate exists and says nought; `hasBurnRate` is what refuses to use it.
    const rate = overallBurnRate([
      reading("2026-03-01", 0),
      reading("2026-03-04", 0),
    ]);
    expect(rate?.centsPerDay).toBe(0);
  });

  it("reads the pace off the last reading however many come before it", () => {
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-02", 10_000),
      reading("2026-03-02", 25_000),
    ]);
    expect(rate?.burnedCents).toBe(25_000);
    expect(rate?.elapsedDays).toBe(2);
  });
});

describe("hasBurnRate", () => {
  it("accepts a pace above nothing", () => {
    expect(hasBurnRate(overallBurnRate([reading("2026-03-01", 12_000)]))).toBe(
      true,
    );
  });

  it("refuses a pace of nothing", () => {
    // Infinity downstream: the contract would last for ever and the project
    // with unvalued hours would be the one with nothing to worry about.
    expect(hasBurnRate(overallBurnRate([reading("2026-03-01", 0)]))).toBe(
      false,
    );
  });

  it("refuses a pace that runs backwards", () => {
    expect(hasBurnRate(overallBurnRate([reading("2026-03-01", -500)]))).toBe(
      false,
    );
  });

  it("refuses an absent pace", () => {
    expect(hasBurnRate(null)).toBe(false);
  });
});
