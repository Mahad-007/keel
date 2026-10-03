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
