import { describe, expect, it } from "vitest";

import { MAX_RATE_CENTS, optionalRateCents, rateInput } from "./rate";

function rejection(input: string, label?: string): string {
  const result = optionalRateCents(input, label);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.message;
}

describe("optionalRateCents", () => {
  it("converts what people type into whole cents", () => {
    expect(optionalRateCents("150")).toEqual({ ok: true, value: 15000 });
    expect(optionalRateCents("150.50")).toEqual({ ok: true, value: 15050 });
    expect(optionalRateCents("$1,250.00")).toEqual({ ok: true, value: 125000 });
    expect(optionalRateCents("  90  ")).toEqual({ ok: true, value: 9000 });
  });

  it("treats a blank field as not set, which is zero", () => {
    expect(optionalRateCents("")).toEqual({ ok: true, value: 0 });
    expect(optionalRateCents("   ")).toEqual({ ok: true, value: 0 });
  });

  it("accepts an explicit zero", () => {
    expect(optionalRateCents("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects anything that is not an amount", () => {
    const message = "Default rate must be an amount, like 150 or 150.00.";
    expect(rejection("abc")).toBe(message);
    expect(rejection("150/hr")).toBe(message);
    expect(rejection("1e4")).toBe(message);
    expect(rejection("--5")).toBe(message);
    expect(rejection("150.")).toBe(message);
  });

  it("rejects a fraction of a cent rather than rounding it away", () => {
    expect(rejection("150.005")).toBe(
      "Default rate must be an amount, like 150 or 150.00.",
    );
  });

  it("rejects a negative rate", () => {
    expect(rejection("-1")).toBe("Default rate cannot be negative.");
    expect(rejection("-0.01")).toBe("Default rate cannot be negative.");
  });

  it("accepts the ceiling and rejects a cent past it", () => {
    expect(optionalRateCents("10000")).toEqual({ ok: true, value: MAX_RATE_CENTS });
    expect(rejection("10000.01")).toBe("Default rate must be $10,000.00 or less.");
  });

  it("names the field the caller gave it", () => {
    expect(rejection("abc", "Rate override")).toBe(
      "Rate override must be an amount, like 150 or 150.00.",
    );
  });
});

describe("rateInput", () => {
  it("shows a set rate as an editable amount", () => {
    expect(rateInput(15000)).toBe("150.00");
    expect(rateInput(13745)).toBe("137.45");
  });

  it("shows an unset rate as a blank field, not as zero", () => {
    expect(rateInput(0)).toBe("");
  });

  it("round-trips every rate the field accepts", () => {
    for (const cents of [0, 1, 100, 15000, MAX_RATE_CENTS]) {
      expect(optionalRateCents(rateInput(cents))).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});
