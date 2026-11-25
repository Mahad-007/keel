import { describe, expect, it } from "vitest";

import { resolveThreshold, rowThreshold } from "./resolve";
import { THRESHOLD_SETTINGS } from "./settings";

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
