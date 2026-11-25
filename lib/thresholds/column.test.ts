import { describe, expect, it } from "vitest";

import { isThresholdValue, thresholdColumn } from "./column";
import { THRESHOLD_SETTINGS } from "./settings";

const NEARLY_SPENT = THRESHOLD_SETTINGS.nearlySpentPercent;

describe("isThresholdValue", () => {
  it("accepts both ends of the setting's own range", () => {
    expect(isThresholdValue("nearlySpentPercent", NEARLY_SPENT.min)).toBe(true);
    expect(isThresholdValue("nearlySpentPercent", NEARLY_SPENT.max)).toBe(true);
  });

  it("refuses one step outside either end", () => {
    expect(isThresholdValue("nearlySpentPercent", NEARLY_SPENT.min - 1)).toBe(
      false,
    );
    expect(isThresholdValue("nearlySpentPercent", NEARLY_SPENT.max + 1)).toBe(
      false,
    );
  });

  it("refuses a fraction of a percent, which no column can hold", () => {
    expect(isThresholdValue("nearlySpentPercent", 82.5)).toBe(false);
  });

  /**
   * The ranges differ per setting, which is the reason the key is an argument:
   * thirty is a perfectly good pace window and a perfectly good watch
   * threshold, and ninety-five is only one of those.
   */
  it("reads each setting's own bounds rather than one shared pair", () => {
    expect(isThresholdValue("recentRateWindowDays", 95)).toBe(false);
    expect(isThresholdValue("nearlySpentPercent", 95)).toBe(true);
    expect(isThresholdValue("recentRateWindowDays", 30)).toBe(true);
  });
});

describe("thresholdColumn", () => {
  it("passes a figure inside the range through unchanged", () => {
    expect(thresholdColumn("nearlySpentPercent", 70)).toBe(70);
  });

  it("reads an explicit null as nothing set here", () => {
    expect(thresholdColumn("nearlySpentPercent", null)).toBeNull();
  });

  it("reads an absent figure the same way", () => {
    expect(thresholdColumn("nearlySpentPercent", undefined)).toBeNull();
  });

  it("throws on a figure the form could never have produced", () => {
    expect(() => thresholdColumn("nearlySpentPercent", 400)).toThrow(
      "Contract nearly spent must be a whole number between 1 and 100, got 400",
    );
  });

  it("names the setting the reader would recognise, not the column", () => {
    expect(() => thresholdColumn("recentRateWindowDays", 0)).toThrow(
      /^Recent pace window must be a whole number between 2 and 90/,
    );
  });

  it("refuses a negative threshold rather than storing it", () => {
    expect(() => thresholdColumn("paceShiftPercent", -10)).toThrow();
  });
});
