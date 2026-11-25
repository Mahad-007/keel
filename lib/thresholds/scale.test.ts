import { describe, expect, it } from "vitest";

import {
  AHEAD_OF_DELIVERY_GAP,
  FAR_AHEAD_OF_DELIVERY_GAP,
  NEARLY_SPENT_SHARE,
} from "@/lib/scope-creep";

import { PERCENT_WHOLE, percentFromShare, shareFromPercent } from "./scale";

describe("shareFromPercent", () => {
  it("divides by the whole rather than multiplying by it", () => {
    expect(shareFromPercent(50)).toBe(0.5);
  });

  it("reads the whole as one", () => {
    expect(shareFromPercent(PERCENT_WHOLE)).toBe(1);
  });

  it("reads nothing as nothing", () => {
    expect(shareFromPercent(0)).toBe(0);
  });

  /**
   * The assertion that matters most, because it is the one that says a project
   * nobody has configured is classified by exactly the arithmetic it was
   * before any of this existed. `toBe` rather than `toBeCloseTo`: if the
   * conversion of the stored default is a fraction off the constant, a
   * threshold fires a cent either side of where its own documentation says,
   * and that is worth failing a test over rather than tolerating.
   */
  it("lands exactly on the three shares the classifier flags on", () => {
    expect(shareFromPercent(80)).toBe(NEARLY_SPENT_SHARE);
    expect(shareFromPercent(25)).toBe(AHEAD_OF_DELIVERY_GAP);
    expect(shareFromPercent(50)).toBe(FAR_AHEAD_OF_DELIVERY_GAP);
  });

  it("carries a percent past the whole through rather than clamping it", () => {
    expect(shareFromPercent(150)).toBe(1.5);
  });

  it("carries a percent below nothing through, sign and all", () => {
    expect(shareFromPercent(-20)).toBe(-0.2);
  });

  it("converts a setting that does not divide evenly without complaint", () => {
    expect(shareFromPercent(33)).toBeCloseTo(0.33, 10);
  });
});

describe("percentFromShare", () => {
  it("multiplies by the whole rather than dividing by it", () => {
    expect(percentFromShare(0.5)).toBe(50);
  });

  it("reads one as the whole", () => {
    expect(percentFromShare(1)).toBe(PERCENT_WHOLE);
  });

  /**
   * The round trip the settings spec depends on: every default it publishes is
   * one of these constants put through this function, and a form offering 81
   * for a threshold that fires at 0.8 would be the spec lying about the
   * classifier.
   */
  it("recovers the whole percent behind each documented share", () => {
    expect(percentFromShare(NEARLY_SPENT_SHARE)).toBe(80);
    expect(percentFromShare(AHEAD_OF_DELIVERY_GAP)).toBe(25);
    expect(percentFromShare(FAR_AHEAD_OF_DELIVERY_GAP)).toBe(50);
  });

  it("rounds a share no column could hold to the nearest setting", () => {
    expect(percentFromShare(1 / 7)).toBe(14);
    expect(percentFromShare(0.805)).toBe(81);
  });

  it("round-trips every whole percent a setting can take", () => {
    for (let percent = 0; percent <= 200; percent++) {
      expect(percentFromShare(shareFromPercent(percent))).toBe(percent);
    }
  });
});
