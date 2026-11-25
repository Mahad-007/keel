import { describe, expect, it } from "vitest";

import {
  AHEAD_OF_DELIVERY_GAP,
  FAR_AHEAD_OF_DELIVERY_GAP,
  NEARLY_SPENT_SHARE,
} from "@/lib/scope-creep";

import { PERCENT_WHOLE, shareFromPercent } from "./scale";

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
