import { describe, expect, it } from "vitest";

import { DEFAULT_CREEP_THRESHOLDS } from "@/lib/scope-creep";

import { creepThresholds } from "./creep";
import { DEFAULT_THRESHOLDS, resolveThresholds } from "./resolve";

describe("creepThresholds", () => {
  /**
   * The assertion that keeps the two halves of the day honest: an
   * unconfigured project is classified by exactly the figures
   * `lib/scope-creep.ts` documents, through the resolution rather than around
   * it.
   */
  it("turns the resolved defaults into the classifier's own defaults", () => {
    expect(creepThresholds(DEFAULT_THRESHOLDS)).toEqual(DEFAULT_CREEP_THRESHOLDS);
  });

  it("converts each configured percent to the share it means", () => {
    const resolved = resolveThresholds(
      {
        nearlySpentPercent: 60,
        aheadOfDeliveryPercent: 10,
        farAheadOfDeliveryPercent: 30,
      },
      null,
    );

    expect(creepThresholds(resolved)).toEqual({
      nearlySpentShare: 0.6,
      aheadOfDeliveryGap: 0.1,
      farAheadOfDeliveryGap: 0.3,
    });
  });

  it("takes an inherited setting as readily as an overridden one", () => {
    const resolved = resolveThresholds(
      { nearlySpentPercent: 90 },
      { aheadOfDeliveryPercent: 40 },
    );

    expect(creepThresholds(resolved).nearlySpentShare).toBe(0.9);
    expect(creepThresholds(resolved).aheadOfDeliveryGap).toBe(0.4);
    expect(creepThresholds(resolved).farAheadOfDeliveryGap).toBe(
      DEFAULT_CREEP_THRESHOLDS.farAheadOfDeliveryGap,
    );
  });

  /**
   * The two projection settings are resolved alongside these three and have no
   * business in a creep verdict. Reading one into the wrong field would be a
   * threshold of fourteen percent of a contract — plausible enough to pass a
   * glance and wrong on every project.
   */
  it("ignores the settings the creep verdict does not rest on", () => {
    const resolved = resolveThresholds(
      { recentRateWindowDays: 30, paceShiftPercent: 60 },
      null,
    );

    expect(creepThresholds(resolved)).toEqual(DEFAULT_CREEP_THRESHOLDS);
  });
});
