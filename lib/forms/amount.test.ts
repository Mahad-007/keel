import { describe, expect, it } from "vitest";

import { amountInput, MAX_AMOUNT_CENTS, optionalAmountCents } from "./amount";

describe("optionalAmountCents", () => {
  it("converts a contracted sum into whole cents", () => {
    expect(optionalAmountCents("12000")).toEqual({ ok: true, value: 1_200_000 });
    expect(optionalAmountCents("$18,500.75")).toEqual({
      ok: true,
      value: 1_850_075,
    });
  });

  it("reads a blank field as not agreed yet, which is zero", () => {
    expect(optionalAmountCents("")).toEqual({ ok: true, value: 0 });
    expect(optionalAmountCents("  ")).toEqual({ ok: true, value: 0 });
  });

  it("accepts the sums a rate field would reject as typos", () => {
    expect(optionalAmountCents("250000")).toEqual({ ok: true, value: 25_000_000 });
  });

  it("accepts the ceiling and rejects a cent past it", () => {
    expect(optionalAmountCents("10000000")).toEqual({
      ok: true,
      value: MAX_AMOUNT_CENTS,
    });
    expect(optionalAmountCents("10000000.01")).toEqual({
      ok: false,
      message: "Contract value must be $10,000,000.00 or less.",
    });
  });

  it("rejects a negative contract value", () => {
    expect(optionalAmountCents("-1")).toEqual({
      ok: false,
      message: "Contract value cannot be negative.",
    });
  });

  it("rejects anything that is not an amount", () => {
    expect(optionalAmountCents("twelve thousand")).toEqual({
      ok: false,
      message: "Contract value must be an amount, like 150 or 150.00.",
    });
  });
});

describe("amountInput", () => {
  it("shows a contracted sum as an editable amount", () => {
    expect(amountInput(1_200_000)).toBe("12000.00");
  });

  it("shows an unagreed value as a blank field, not as zero", () => {
    expect(amountInput(0)).toBe("");
  });

  it("round-trips every amount the field accepts", () => {
    for (const cents of [0, 1, 1_200_000, MAX_AMOUNT_CENTS]) {
      expect(optionalAmountCents(amountInput(cents))).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});
