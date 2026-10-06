import { describe, expect, it } from "vitest";

import { estimateInput, optionalEstimateMinutes } from "./estimate";

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

describe("an estimate that cannot be stored", () => {
  it("says what the field wants when it is not a number", () => {
    expect(optionalEstimateMinutes("a day")).toEqual({
      ok: false,
      message: "Estimate must be a number of hours, like 2 or 1.5.",
    });
  });

  it("refuses a negative estimate", () => {
    expect(optionalEstimateMinutes("-2")).toEqual({
      ok: false,
      message: "Estimate cannot be negative.",
    });
  });

  it("refuses the figure above the ceiling, naming it in hours", () => {
    expect(optionalEstimateMinutes("1001")).toEqual({
      ok: false,
      message: "Estimate must be 1000 hours or less.",
    });
  });

  it("names the field the caller asked about", () => {
    expect(optionalEstimateMinutes("soon", "Design estimate")).toEqual({
      ok: false,
      message: "Design estimate must be a number of hours, like 2 or 1.5.",
    });
  });
});

describe("prefilling an estimate field", () => {
  it("leaves the box empty for a line nobody has estimated", () => {
    expect(estimateInput(0)).toBe("");
  });

  it("offers the stored estimate back in hours", () => {
    expect(estimateInput(90)).toBe("1.5");
    expect(estimateInput(480)).toBe("8");
  });

  it("round-trips, so opening a deliverable and saving it changes nothing", () => {
    for (const minutes of [0, 1, 20, 45, 90, 480, 60_000]) {
      expect(optionalEstimateMinutes(estimateInput(minutes))).toEqual({
        ok: true,
        value: minutes,
      });
    }
  });

  it("offers back an estimate the validator would now refuse", () => {
    // A row holding more than the maximum can only have been written before
    // the limit existed or by hand. The form shows what is there rather than a
    // blank: a reader cannot fix a figure the page will not tell them.
    expect(estimateInput(120_000)).toBe("2000");
    expect(optionalEstimateMinutes("2000").ok).toBe(false);
  });
});
