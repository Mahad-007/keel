import { describe, expect, it } from "vitest";

import { PACE_SHIFT_THRESHOLD, RECENT_RATE_WINDOW_DAYS } from "@/lib/projection/rate";
import {
  AHEAD_OF_DELIVERY_GAP,
  FAR_AHEAD_OF_DELIVERY_GAP,
  NEARLY_SPENT_SHARE,
} from "@/lib/scope-creep";

import { shareFromPercent } from "./scale";
import { THRESHOLD_KEYS, THRESHOLD_SETTINGS } from "./settings";

/**
 * The spec is a record of literals, so most of what could be asserted about it
 * is a getter. What is worth a test is the handful of invariants that hold
 * across the whole record and that an edit could break silently: a default
 * outside its own bounds, a default that no longer matches the constant
 * documenting it, and a pair of bounds that leaves nothing to choose from.
 */

const SETTINGS = THRESHOLD_KEYS.map((key) => [key, THRESHOLD_SETTINGS[key]] as const);

describe("THRESHOLD_SETTINGS bounds", () => {
  it.each(SETTINGS)("leaves %s something to choose from", (_key, setting) => {
    expect(setting.min).toBeLessThan(setting.max);
  });

  it.each(SETTINGS)("keeps %s's own default within its bounds", (_key, setting) => {
    expect(setting.fallback).toBeGreaterThanOrEqual(setting.min);
    expect(setting.fallback).toBeLessThanOrEqual(setting.max);
  });

  it.each(SETTINGS)("bounds %s to whole numbers a column can hold", (_key, setting) => {
    expect(Number.isSafeInteger(setting.min)).toBe(true);
    expect(Number.isSafeInteger(setting.max)).toBe(true);
    expect(Number.isSafeInteger(setting.fallback)).toBe(true);
  });
});

describe("THRESHOLD_SETTINGS defaults", () => {
  /**
   * The assertion the whole spec rests on. Every default is published as the
   * figure the app applies when nothing is configured, and the figure the app
   * applies is the constant in the module that explains it. If these part
   * company, a form offers a number the classifier does not use — and the
   * reader who typed nothing is the one who finds out.
   */
  it("offers the three shares the creep classifier flags on", () => {
    expect(shareFromPercent(THRESHOLD_SETTINGS.nearlySpentPercent.fallback)).toBe(
      NEARLY_SPENT_SHARE,
    );
    expect(shareFromPercent(THRESHOLD_SETTINGS.aheadOfDeliveryPercent.fallback)).toBe(
      AHEAD_OF_DELIVERY_GAP,
    );
    expect(
      shareFromPercent(THRESHOLD_SETTINGS.farAheadOfDeliveryPercent.fallback),
    ).toBe(FAR_AHEAD_OF_DELIVERY_GAP);
  });

  it("offers the window and the pace shift the projection uses", () => {
    expect(THRESHOLD_SETTINGS.recentRateWindowDays.fallback).toBe(
      RECENT_RATE_WINDOW_DAYS,
    );
    expect(shareFromPercent(THRESHOLD_SETTINGS.paceShiftPercent.fallback)).toBe(
      PACE_SHIFT_THRESHOLD,
    );
  });

  /**
   * The defaults as shipped have to be coherent even though a configured pair
   * need not be: the watch band has to open before the over band, or no
   * project is ever merely watched.
   */
  it("opens the watch band before the over band on both axes", () => {
    expect(THRESHOLD_SETTINGS.aheadOfDeliveryPercent.fallback).toBeLessThan(
      THRESHOLD_SETTINGS.farAheadOfDeliveryPercent.fallback,
    );
    expect(THRESHOLD_SETTINGS.nearlySpentPercent.fallback).toBeLessThan(100);
  });
});

describe("THRESHOLD_SETTINGS words", () => {
  it("gives every setting a distinct label, since a form shows all five", () => {
    const labels = SETTINGS.map(([, setting]) => setting.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("says what each setting does rather than repeating its label", () => {
    for (const [, setting] of SETTINGS) {
      expect(setting.hint.length).toBeGreaterThan(setting.label.length);
      expect(setting.hint).not.toBe(setting.label);
    }
  });
});
