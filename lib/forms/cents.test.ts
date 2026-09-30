import { describe, expect, it } from "vitest";

import {
  optionalCentsField,
  optionalCentsInput,
  zeroedCentsField,
  zeroedCentsInput,
} from "./cents";

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

describe("zeroedCentsField", () => {
  it("reads a blank field as zero rather than as nothing", () => {
    expect(zeroedCentsField("", OPTIONS)).toEqual({ ok: true, value: 0 });
    expect(zeroedCentsField("   ", OPTIONS)).toEqual({ ok: true, value: 0 });
  });

  it("reads a typed zero the same way, because there is no difference to keep", () => {
    expect(zeroedCentsField("0", OPTIONS)).toEqual({ ok: true, value: 0 });
  });

  it("passes an amount and a refusal through untouched", () => {
    expect(zeroedCentsField("150.50", OPTIONS)).toEqual({ ok: true, value: 15050 });
    expect(zeroedCentsField("-1", OPTIONS)).toEqual({
      ok: false,
      message: "Contract value cannot be negative.",
    });
  });
});

describe("zeroedCentsInput", () => {
  it("renders an amount as the digits a form accepts back", () => {
    expect(zeroedCentsInput(15000)).toBe("150.00");
    expect(zeroedCentsInput(13745)).toBe("137.45");
  });

  it("renders zero as an empty box, not as a figure somebody chose", () => {
    expect(zeroedCentsInput(0)).toBe("");
  });

  it("round-trips every amount back through the field", () => {
    for (const cents of [0, 1, 999, 15000, 1_000_000]) {
      expect(zeroedCentsField(zeroedCentsInput(cents), OPTIONS)).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});

describe("optionalCentsInput", () => {
  it("renders nothing set as an empty box", () => {
    expect(optionalCentsInput(null)).toBe("");
  });

  it("renders a deliberate zero as a figure, which is what it is", () => {
    expect(optionalCentsInput(0)).toBe("0.00");
  });

  it("round-trips absence and zero back as the different things they are", () => {
    for (const cents of [null, 0, 18050]) {
      expect(optionalCentsField(optionalCentsInput(cents), OPTIONS)).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});
