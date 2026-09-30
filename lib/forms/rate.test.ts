import { describe, expect, it } from "vitest";

import { optionalCentsInput, zeroedCentsInput } from "./cents";
import {
  MAX_RATE_CENTS,
  optionalRateCents,
  overrideRateCents,
} from "./rate";

/**
 * What is specific to a rate: its ceiling, the field name it uses when the
 * caller gives none, and what a blank field means in each of the two places a
 * rate is asked for. Parsing, negatives and the wording of every message belong
 * to `optionalCentsField` and are tested in `cents.test.ts` — asserting them
 * again here would be two suites over one code path, both free to drift.
 */

function rejection(input: string, label?: string): string {
  const result = optionalRateCents(input, label);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.message;
}

describe("optionalRateCents", () => {
  it("treats a blank field as not set, which is zero", () => {
    expect(optionalRateCents("")).toEqual({ ok: true, value: 0 });
    expect(optionalRateCents("   ")).toEqual({ ok: true, value: 0 });
  });

  it("accepts an explicit zero, which says the same thing", () => {
    expect(optionalRateCents("0")).toEqual({ ok: true, value: 0 });
  });

  it("accepts the ceiling and rejects a cent past it", () => {
    expect(optionalRateCents("10000")).toEqual({ ok: true, value: MAX_RATE_CENTS });
    expect(rejection("10000.01")).toBe("Default rate must be $10,000.00 or less.");
  });

  it("calls the field a default rate when the caller does not name it", () => {
    expect(rejection("abc")).toBe(
      "Default rate must be an amount, like 150 or 150.00.",
    );
  });

  it("names the field the caller gave it instead", () => {
    expect(rejection("abc", "Rate override")).toBe(
      "Rate override must be an amount, like 150 or 150.00.",
    );
  });

  it("round-trips every rate the field accepts", () => {
    for (const cents of [0, 1, 100, 15000, MAX_RATE_CENTS]) {
      expect(optionalRateCents(zeroedCentsInput(cents))).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});

describe("overrideRateCents", () => {
  it("reads a blank override as no override at all", () => {
    expect(overrideRateCents("")).toEqual({ ok: true, value: null });
    expect(overrideRateCents("   ")).toEqual({ ok: true, value: null });
  });

  it("keeps an override of zero, which is not the same as none", () => {
    expect(overrideRateCents("0")).toEqual({ ok: true, value: 0 });
  });

  it("converts a typed override into whole cents", () => {
    expect(overrideRateCents("$180.50")).toEqual({ ok: true, value: 18050 });
  });

  it("holds the override to the same range as any other rate", () => {
    expect(overrideRateCents("-1")).toEqual({
      ok: false,
      message: "Rate override cannot be negative.",
    });
    expect(overrideRateCents("10000.01")).toEqual({
      ok: false,
      message: "Rate override must be $10,000.00 or less.",
    });
  });

  it("round-trips every override the field accepts, absence included", () => {
    for (const cents of [null, 0, 1, 18050, MAX_RATE_CENTS]) {
      expect(overrideRateCents(optionalCentsInput(cents))).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});
