import { describe, expect, it } from "vitest";

import { DEFAULT_PACE_SETTINGS } from "@/lib/projection/rate";

import { paceSettings } from "./pace";
import { DEFAULT_THRESHOLDS, resolveThresholds } from "./resolve";

describe("paceSettings", () => {
  it("turns the resolved defaults into the projection's own defaults", () => {
    expect(paceSettings(DEFAULT_THRESHOLDS)).toEqual(DEFAULT_PACE_SETTINGS);
  });

  it("carries a configured window through in days, unconverted", () => {
    const resolved = resolveThresholds({ recentRateWindowDays: 30 }, null);

    expect(paceSettings(resolved).recentWindowDays).toBe(30);
  });

  it("converts the configured shift from percent to a fraction", () => {
    const resolved = resolveThresholds({ paceShiftPercent: 40 }, null);

    expect(paceSettings(resolved).paceShiftThreshold).toBe(0.4);
  });

  it("takes an inherited setting as readily as an overridden one", () => {
    const resolved = resolveThresholds(
      { recentRateWindowDays: 7 },
      { paceShiftPercent: 10 },
    );

    expect(paceSettings(resolved)).toEqual({
      recentWindowDays: 7,
      paceShiftThreshold: 0.1,
    });
  });

  /**
   * The three creep settings are resolved alongside these two and have no
   * business in a forecast. A watch threshold read into the window would be a
   * pace measured over eighty days on every project in the app.
   */
  it("ignores the settings the projection does not rest on", () => {
    const resolved = resolveThresholds({ nearlySpentPercent: 70 }, null);

    expect(paceSettings(resolved)).toEqual(DEFAULT_PACE_SETTINGS);
  });
});
