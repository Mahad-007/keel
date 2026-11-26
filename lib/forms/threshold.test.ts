import { describe, expect, it } from "vitest";

import { THRESHOLD_KEYS, THRESHOLD_SETTINGS } from "@/lib/thresholds/settings";

import {
  BLANK_THRESHOLD_FIELDS,
  optionalThresholdSetting,
  THRESHOLD_FIELD_NAMES,
  thresholdInput,
} from "./threshold";

function rejection(key: Parameters<typeof optionalThresholdSetting>[0], input: string): string {
  const result = optionalThresholdSetting(key, input);
  if (result.ok) throw new Error(`expected ${input} to be rejected`);
  return result.message;
}

describe("optionalThresholdSetting", () => {
  it("reads a blank box as inherit rather than as a figure", () => {
    expect(optionalThresholdSetting("nearlySpentPercent", "")).toEqual({
      ok: true,
      value: null,
    });
    expect(optionalThresholdSetting("nearlySpentPercent", "   ")).toEqual({
      ok: true,
      value: null,
    });
  });

  it("accepts a figure inside the range", () => {
    expect(optionalThresholdSetting("nearlySpentPercent", "70")).toEqual({
      ok: true,
      value: 70,
    });
  });

  it("accepts a figure with space around it", () => {
    expect(optionalThresholdSetting("nearlySpentPercent", " 70 ")).toEqual({
      ok: true,
      value: 70,
    });
  });

  it("accepts both ends of the setting's own range", () => {
    const { min, max } = THRESHOLD_SETTINGS.recentRateWindowDays;
    expect(
      optionalThresholdSetting("recentRateWindowDays", String(min)),
    ).toEqual({ ok: true, value: min });
    expect(
      optionalThresholdSetting("recentRateWindowDays", String(max)),
    ).toEqual({ ok: true, value: max });
  });

  it("refuses something that is not a number", () => {
    expect(rejection("nearlySpentPercent", "most of it")).toBe(
      "Contract nearly spent must be a whole percent, like 100.",
    );
  });

  it("refuses a fraction of a percent", () => {
    expect(rejection("nearlySpentPercent", "82.5")).toBe(
      "Contract nearly spent must be a whole percent, with no decimals.",
    );
  });

  it("names the unit the setting is actually in", () => {
    expect(rejection("recentRateWindowDays", "a fortnight")).toBe(
      "Recent pace window must be a whole number of days, like 90.",
    );
  });

  it("refuses a figure past the top of the range, quoting both ends", () => {
    expect(rejection("nearlySpentPercent", "120")).toBe(
      "Contract nearly spent must be between 1 and 100.",
    );
  });

  it("refuses zero, which would flag every project from its first hour", () => {
    expect(rejection("nearlySpentPercent", "0")).toBe(
      "Contract nearly spent must be between 1 and 100.",
    );
  });

  it("refuses a negative threshold", () => {
    expect(rejection("paceShiftPercent", "-10")).toBe(
      "Pace change must be between 1 and 99.",
    );
  });

  /**
   * The bounds are per setting, which is the reason the key is the first
   * argument: ninety-five days is not a recent window and ninety-five percent
   * is a perfectly good one.
   */
  it("holds each setting to its own range", () => {
    expect(optionalThresholdSetting("nearlySpentPercent", "95").ok).toBe(true);
    expect(optionalThresholdSetting("recentRateWindowDays", "95").ok).toBe(
      false,
    );
  });

  it("accepts every setting's own default back unchanged", () => {
    for (const key of THRESHOLD_KEYS) {
      const { fallback } = THRESHOLD_SETTINGS[key];
      expect(optionalThresholdSetting(key, String(fallback))).toEqual({
        ok: true,
        value: fallback,
      });
    }
  });
});

describe("thresholdInput", () => {
  it("renders a stored setting as the figure somebody typed", () => {
    expect(thresholdInput(70)).toBe("70");
  });

  it("renders an unset column as an empty box", () => {
    expect(thresholdInput(null)).toBe("");
  });

  /**
   * The round trip the edit form depends on: opening a row and saving it
   * untouched has to write the same row back, rather than quietly turning an
   * inherited setting into an explicit one or vice versa.
   */
  it("round-trips every setting a column can hold", () => {
    for (const key of THRESHOLD_KEYS) {
      const { min, max } = THRESHOLD_SETTINGS[key];
      for (const stored of [null, min, max, THRESHOLD_SETTINGS[key].fallback]) {
        expect(optionalThresholdSetting(key, thresholdInput(stored))).toEqual({
          ok: true,
          value: stored,
        });
      }
    }
  });
});

describe("THRESHOLD_FIELD_NAMES", () => {
  /**
   * The names are the spec's keys, which is what lets `readFields` and
   * `collect` key a submitted box, an error message and a column the same way.
   * A field name that drifted from its key would read as a blank box —
   * "inherit" — rather than as a bug, so the drift would be silent and the
   * setting simply would not save.
   */
  it("is the spec's own keys, in the spec's own order", () => {
    expect(THRESHOLD_FIELD_NAMES).toEqual(THRESHOLD_KEYS);
  });
});

describe("BLANK_THRESHOLD_FIELDS", () => {
  it("has an empty box for every setting in the spec", () => {
    expect(Object.keys(BLANK_THRESHOLD_FIELDS).sort()).toEqual(
      [...THRESHOLD_KEYS].sort(),
    );
    for (const key of THRESHOLD_KEYS) {
      expect(BLANK_THRESHOLD_FIELDS[key]).toBe("");
    }
  });

  /** Every box of an untouched form parses, and every one of them inherits. */
  it("parses as five settings nobody has set", () => {
    for (const key of THRESHOLD_KEYS) {
      expect(optionalThresholdSetting(key, BLANK_THRESHOLD_FIELDS[key])).toEqual(
        { ok: true, value: null },
      );
    }
  });

  it("cannot be edited by the forms that spread it", () => {
    expect(() => {
      BLANK_THRESHOLD_FIELDS.nearlySpentPercent = "70";
    }).toThrow();
  });
});
