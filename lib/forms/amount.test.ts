import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_CENTS, optionalAmountCents } from "./amount";
import { zeroedCentsInput } from "./cents";

/**
 * What is specific to a contracted sum: its ceiling, which is far past any
 * plausible rate, the field name it uses when the caller gives none, and a blank
 * field meaning nobody has agreed a figure. Parsing and the rest of the wording
 * belong to `optionalCentsField` and are tested in `cents.test.ts`.
 */

describe("optionalAmountCents", () => {
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

  it("calls the field a contract value when the caller does not name it", () => {
    expect(optionalAmountCents("twelve thousand")).toEqual({
      ok: false,
      message: "Contract value must be an amount, like 150 or 150.00.",
    });
  });

  it("names the field the caller gave it instead", () => {
    expect(optionalAmountCents("-1", "Budget")).toEqual({
      ok: false,
      message: "Budget cannot be negative.",
    });
  });

  it("round-trips every amount the field accepts", () => {
    for (const cents of [0, 1, 1_200_000, MAX_AMOUNT_CENTS]) {
      expect(optionalAmountCents(zeroedCentsInput(cents))).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});
