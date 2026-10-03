import { describe, expect, it } from "vitest";

import { optionalEstimateMinutes } from "./estimate";

describe("an estimate field left alone", () => {
  it("is zero, the stored way of saying nobody has estimated it", () => {
    expect(optionalEstimateMinutes("")).toEqual({ ok: true, value: 0 });
  });

  it("counts a field holding only whitespace as untouched", () => {
    expect(optionalEstimateMinutes("   ")).toEqual({ ok: true, value: 0 });
  });

  it("keeps an explicit zero as zero rather than treating it as absent", () => {
    expect(optionalEstimateMinutes("0")).toEqual({ ok: true, value: 0 });
  });
});

describe("an estimate somebody has typed", () => {
  it("converts whole hours to minutes", () => {
    expect(optionalEstimateMinutes("8")).toEqual({ ok: true, value: 480 });
  });

  it("converts a fraction of an hour", () => {
    expect(optionalEstimateMinutes("1.5")).toEqual({ ok: true, value: 90 });
    expect(optionalEstimateMinutes(".25")).toEqual({ ok: true, value: 15 });
  });

  it("accepts the largest estimate that is still a judgement", () => {
    expect(optionalEstimateMinutes("1000")).toEqual({ ok: true, value: 60_000 });
  });
});
