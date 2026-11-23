import { describe, expect, it } from "vitest";

import { centsPerDay } from "./rate";

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
