import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  NO_THRESHOLD_OVERRIDES,
  pickThresholdOverrides,
  resolveThreshold,
  resolveThresholds,
  rowThreshold,
} from "./resolve";
import { THRESHOLD_KEYS, THRESHOLD_SETTINGS } from "./settings";

/**
 * The milestone's own sentence — "falling back to sensible defaults, with the
 * resolution logic tested" — so the cases are the rungs of the chain and every
 * way a rung can be absent. The expensive failure is silent: a project that
 * inherits nothing because an unset column was read as a setting of zero would
 * be classified at a threshold nobody typed, and every figure on its banner
 * would look like a measurement.
 */

const DEFAULT_NEARLY_SPENT = THRESHOLD_SETTINGS.nearlySpentPercent.fallback;

describe("rowThreshold", () => {
  it("reads a setting the row holds", () => {
    expect(rowThreshold("nearlySpentPercent", { nearlySpentPercent: 70 })).toBe(70);
  });

  it("reads a NULL column as nothing set", () => {
    expect(rowThreshold("nearlySpentPercent", { nearlySpentPercent: null })).toBeNull();
  });

  it("reads an absent key the same as a NULL one", () => {
    expect(rowThreshold("nearlySpentPercent", {})).toBeNull();
  });

  it("answers for a row that was never read", () => {
    expect(rowThreshold("nearlySpentPercent", null)).toBeNull();
  });

  it("does not let one setting answer for another", () => {
    expect(rowThreshold("aheadOfDeliveryPercent", { nearlySpentPercent: 70 })).toBeNull();
  });
});

describe("resolveThreshold", () => {
  it("takes the project's own setting when it has one", () => {
    expect(
      resolveThreshold("nearlySpentPercent", { nearlySpentPercent: 70 }, {
        nearlySpentPercent: 60,
      }),
    ).toEqual({ value: 70, source: "project" });
  });

  it("falls to the client when the project has not been set", () => {
    expect(
      resolveThreshold("nearlySpentPercent", { nearlySpentPercent: null }, {
        nearlySpentPercent: 60,
      }),
    ).toEqual({ value: 60, source: "client" });
  });

  it("falls to the default when neither row has been set", () => {
    expect(resolveThreshold("nearlySpentPercent", {}, {})).toEqual({
      value: DEFAULT_NEARLY_SPENT,
      source: "default",
    });
  });

  it("falls to the default for a project read without its client", () => {
    expect(resolveThreshold("nearlySpentPercent", {}, null)).toEqual({
      value: DEFAULT_NEARLY_SPENT,
      source: "default",
    });
  });

  /**
   * The resolution is per setting, not per row. A client who has set one
   * threshold has not thereby set the other four, and a project that overrides
   * one still inherits the rest — which is the whole reason the columns are
   * separate and nullable rather than a single blob.
   */
  it("resolves each setting on its own evidence", () => {
    const project = { aheadOfDeliveryPercent: 15 };
    const client = { nearlySpentPercent: 60 };

    expect(resolveThreshold("aheadOfDeliveryPercent", project, client)).toEqual({
      value: 15,
      source: "project",
    });
    expect(resolveThreshold("nearlySpentPercent", project, client)).toEqual({
      value: 60,
      source: "client",
    });
    expect(resolveThreshold("paceShiftPercent", project, client)).toEqual({
      value: THRESHOLD_SETTINGS.paceShiftPercent.fallback,
      source: "default",
    });
  });

  /**
   * A stored figure outside the bounds the form enforces can only have got
   * there by a hand-edited row, and it is carried rather than repaired — the
   * same choice `lib/rates.ts` makes about a negative rate. A threshold
   * silently replaced by the default would classify the project at a figure
   * its own settings page does not show, and nobody could work out why.
   */
  it("carries a setting outside its bounds rather than repairing it", () => {
    expect(
      resolveThreshold("nearlySpentPercent", { nearlySpentPercent: 400 }, {}),
    ).toEqual({ value: 400, source: "project" });
  });

  it("treats a stored zero as a setting, not as an absence", () => {
    expect(
      resolveThreshold("nearlySpentPercent", { nearlySpentPercent: 0 }, {
        nearlySpentPercent: 60,
      }),
    ).toEqual({ value: 0, source: "project" });
  });
});

describe("resolveThresholds", () => {
  it("resolves every setting in the spec, not just the ones that were set", () => {
    const resolved = resolveThresholds({ nearlySpentPercent: 70 }, null);
    expect(Object.keys(resolved).sort()).toEqual([...THRESHOLD_KEYS].sort());
  });

  it("mixes sources across the five settings in one pass", () => {
    const resolved = resolveThresholds(
      { nearlySpentPercent: 70, recentRateWindowDays: null },
      { recentRateWindowDays: 30 },
    );

    expect(resolved.nearlySpentPercent).toEqual({ value: 70, source: "project" });
    expect(resolved.recentRateWindowDays).toEqual({ value: 30, source: "client" });
    expect(resolved.paceShiftPercent.source).toBe("default");
  });

  it("agrees with the single-setting resolution for every key", () => {
    const project = { aheadOfDeliveryPercent: 15, paceShiftPercent: 40 };
    const client = { nearlySpentPercent: 60, farAheadOfDeliveryPercent: 35 };
    const resolved = resolveThresholds(project, client);

    for (const key of THRESHOLD_KEYS) {
      expect(resolved[key]).toEqual(resolveThreshold(key, project, client));
    }
  });
});

describe("DEFAULT_THRESHOLDS", () => {
  it("is every spec default, attributed to no row", () => {
    for (const key of THRESHOLD_KEYS) {
      expect(DEFAULT_THRESHOLDS[key]).toEqual({
        value: THRESHOLD_SETTINGS[key].fallback,
        source: "default",
      });
    }
  });

  it("is what two empty rows resolve to", () => {
    expect(resolveThresholds({}, {})).toEqual(DEFAULT_THRESHOLDS);
  });
});

describe("NO_THRESHOLD_OVERRIDES", () => {
  it("covers every setting in the spec, so a row type is satisfied", () => {
    expect(Object.keys(NO_THRESHOLD_OVERRIDES).sort()).toEqual(
      [...THRESHOLD_KEYS].sort(),
    );
  });

  it("resolves to the defaults from both rungs of the chain", () => {
    expect(
      resolveThresholds(NO_THRESHOLD_OVERRIDES, NO_THRESHOLD_OVERRIDES),
    ).toEqual(DEFAULT_THRESHOLDS);
  });
});

describe("pickThresholdOverrides", () => {
  it("reads every setting off a row, NULL for the ones it has not got", () => {
    expect(pickThresholdOverrides({ nearlySpentPercent: 70 })).toEqual({
      ...NO_THRESHOLD_OVERRIDES,
      nearlySpentPercent: 70,
    });
  });

  it("answers for every setting even from an empty row", () => {
    expect(pickThresholdOverrides({})).toEqual(NO_THRESHOLD_OVERRIDES);
  });

  /**
   * A copy has to be able to see a bad stored figure, because whether the row
   * can be copied at all is decided from what it holds. Repairing it here would
   * hand a caller a row that passed a check it should have failed.
   */
  it("carries a figure outside its range rather than dropping it", () => {
    expect(pickThresholdOverrides({ paceShiftPercent: 400 })).toEqual({
      ...NO_THRESHOLD_OVERRIDES,
      paceShiftPercent: 400,
    });
  });
});
