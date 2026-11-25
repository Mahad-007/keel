import { describe, expect, it } from "vitest";

import {
  hasDeliveryWatchBand,
  hasUsableSettings,
  thresholdProblems,
  unusableSettingLabels,
} from "./coherence";
import {
  DEFAULT_THRESHOLDS,
  resolveThresholds,
  type ThresholdOverrides,
} from "./resolve";

/** The settings in force for a project configured this way and no further. */
function inForce(project: ThresholdOverrides, client: ThresholdOverrides = {}) {
  return resolveThresholds(project, client);
}

describe("hasDeliveryWatchBand", () => {
  it("is true on the defaults, which leave a band a quarter wide", () => {
    expect(hasDeliveryWatchBand(DEFAULT_THRESHOLDS)).toBe(true);
  });

  it("is true for a narrow band somebody chose", () => {
    expect(
      hasDeliveryWatchBand(
        inForce({ aheadOfDeliveryPercent: 29, farAheadOfDeliveryPercent: 30 }),
      ),
    ).toBe(true);
  });

  it("is false when the two figures are the same", () => {
    expect(
      hasDeliveryWatchBand(
        inForce({ aheadOfDeliveryPercent: 30, farAheadOfDeliveryPercent: 30 }),
      ),
    ).toBe(false);
  });

  it("is false when they are the wrong way round", () => {
    expect(
      hasDeliveryWatchBand(
        inForce({ aheadOfDeliveryPercent: 50, farAheadOfDeliveryPercent: 20 }),
      ),
    ).toBe(false);
  });

  /**
   * The case a single form cannot catch, and the reason this file exists: each
   * figure was typed into a different form, and each one is in range.
   */
  it("is false for a pair split across the project and its client", () => {
    expect(
      hasDeliveryWatchBand(
        inForce(
          { aheadOfDeliveryPercent: 50 },
          { farAheadOfDeliveryPercent: 20 },
        ),
      ),
    ).toBe(false);
  });
});

describe("hasUsableSettings", () => {
  it("is true on the defaults", () => {
    expect(hasUsableSettings(DEFAULT_THRESHOLDS)).toBe(true);
  });

  it("is false for a figure past the range the form allows", () => {
    expect(hasUsableSettings(inForce({ nearlySpentPercent: 400 }))).toBe(false);
  });

  it("is false for an inherited figure nobody could have typed", () => {
    expect(hasUsableSettings(inForce({}, { recentRateWindowDays: 0 }))).toBe(
      false,
    );
  });
});

describe("thresholdProblems", () => {
  it("finds nothing wrong with the defaults", () => {
    expect(thresholdProblems(DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it("finds nothing wrong with a coherent set of overrides", () => {
    expect(
      thresholdProblems(
        inForce({ nearlySpentPercent: 60, aheadOfDeliveryPercent: 10 }),
      ),
    ).toEqual([]);
  });

  it("names crossed delivery gaps", () => {
    expect(
      thresholdProblems(
        inForce({ aheadOfDeliveryPercent: 50, farAheadOfDeliveryPercent: 20 }),
      ),
    ).toEqual(["crossed-delivery-gaps"]);
  });

  it("leads with an unusable setting, which makes the bands suspect", () => {
    expect(
      thresholdProblems(
        inForce({
          nearlySpentPercent: 400,
          aheadOfDeliveryPercent: 50,
          farAheadOfDeliveryPercent: 20,
        }),
      ),
    ).toEqual(["unusable-setting", "crossed-delivery-gaps"]);
  });
});

describe("unusableSettingLabels", () => {
  it("names nothing when every setting is in range", () => {
    expect(unusableSettingLabels(DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it("names the setting as its own form label", () => {
    expect(unusableSettingLabels(inForce({ nearlySpentPercent: 400 }))).toEqual([
      "Contract nearly spent",
    ]);
  });

  it("names them in the order the form lays the boxes out", () => {
    expect(
      unusableSettingLabels(
        inForce({ paceShiftPercent: 400, nearlySpentPercent: 400 }),
      ),
    ).toEqual(["Contract nearly spent", "Pace change"]);
  });
});
