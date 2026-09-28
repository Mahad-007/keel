import { describe, expect, it } from "vitest";

import { optionalCentsField } from "./cents";

const OPTIONS = { label: "Contract value", max: 1_000_000 };

function parse(input: string) {
  return optionalCentsField(input, OPTIONS);
}

function rejection(input: string): string {
  const result = parse(input);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.message;
}

describe("optionalCentsField", () => {
  it("converts what people type into whole cents", () => {
    expect(parse("150")).toEqual({ ok: true, value: 15000 });
    expect(parse("150.50")).toEqual({ ok: true, value: 15050 });
    expect(parse("$1,250.00")).toEqual({ ok: true, value: 125000 });
    expect(parse("  90  ")).toEqual({ ok: true, value: 9000 });
  });

  it("reads a blank field as no value rather than as zero", () => {
    expect(parse("")).toEqual({ ok: true, value: null });
    expect(parse("   ")).toEqual({ ok: true, value: null });
  });

  it("keeps an explicit zero, which is not the same as a blank one", () => {
    expect(parse("0")).toEqual({ ok: true, value: 0 });
    expect(parse("0.00")).toEqual({ ok: true, value: 0 });
  });

  it("rejects anything that is not an amount", () => {
    const message = "Contract value must be an amount, like 150 or 150.00.";
    expect(rejection("abc")).toBe(message);
    expect(rejection("1e4")).toBe(message);
    expect(rejection("--5")).toBe(message);
    expect(rejection("150.")).toBe(message);
  });

  it("rejects a fraction of a cent rather than rounding it away", () => {
    expect(rejection("150.005")).toBe(
      "Contract value must be an amount, like 150 or 150.00.",
    );
  });

  it("rejects a negative amount", () => {
    expect(rejection("-1")).toBe("Contract value cannot be negative.");
    expect(rejection("-0.01")).toBe("Contract value cannot be negative.");
  });

  it("accepts the ceiling and rejects a cent past it", () => {
    expect(parse("10000")).toEqual({ ok: true, value: 1_000_000 });
    expect(rejection("10000.01")).toBe(
      "Contract value must be $10,000.00 or less.",
    );
  });

  it("names the field it was given in every message", () => {
    const result = optionalCentsField("-1", { label: "Rate override", max: 10 });
    expect(result).toEqual({
      ok: false,
      message: "Rate override cannot be negative.",
    });
  });
});
