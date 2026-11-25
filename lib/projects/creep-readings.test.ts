import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { UNRATED, type EffectiveRate } from "@/lib/rates";
import type { ScopeLine } from "@/lib/scope";
import { DEFAULT_CREEP_THRESHOLDS } from "@/lib/scope-creep";

import { assessProjectCreep, projectCreepReadings } from "./creep-readings";

/** The common case: a rate set on the project itself, $200 an hour. */
const AT_200: EffectiveRate = { cents: 20_000, source: "project" };

/**
 * A burn summary built the way the overview panel builds one: totals, a price,
 * a rate. Through `summariseBurn` rather than written out as an object, so the
 * share these tests read is the share the arithmetic produces.
 */
function burn(
  loggedMinutes: number,
  contractedCents: number,
  rate: EffectiveRate = AT_200,
): BurnSummary {
  return summariseBurn(
    {
      entryCount: loggedMinutes === 0 ? 0 : 1,
      loggedMinutes,
      billableMinutes: loggedMinutes,
    },
    contractedCents,
    rate,
  );
}

/** One scope line, pending unless its status says otherwise. */
function line(estimatedMinutes: number, status: ScopeLine["status"] = "pending"): ScopeLine {
  return { estimatedMinutes, status };
}

describe("the money half of the readings", () => {
  it("carries the burn summary's own consumed share", () => {
    // Thirty hours at $200 is $6,000 of a $10,000 contract.
    const readings = projectCreepReadings(burn(1_800, 1_000_000), []);

    expect(readings.consumedShare).toBeCloseTo(0.6);
  });

  it("carries a share past the whole unclamped", () => {
    // Sixty hours at $200 is $12,000 of a $10,000 contract. The figure the
    // classifier was built to act on, and the one a caller that clamped at the
    // whole would hand over as a project reading merely finished.
    const readings = projectCreepReadings(burn(3_600, 1_000_000), []);

    expect(readings.consumedShare).toBeCloseTo(1.2);
  });

  it("has no share when there is no price to divide by", () => {
    const readings = projectCreepReadings(burn(1_800, 0), []);

    expect(readings.consumedShare).toBeNull();
  });

  it("calls the burn valued when a rate priced it", () => {
    expect(projectCreepReadings(burn(1_800, 1_000_000), []).burnValued).toBe(
      true,
    );
  });

  it("calls the burn unvalued when hours were logged with no rate anywhere", () => {
    const readings = projectCreepReadings(burn(1_800, 1_000_000, UNRATED), []);

    // The share is a well-formed nought, which is exactly the reading the
    // classifier has to be told not to believe.
    expect(readings.consumedShare).toBe(0);
    expect(readings.burnValued).toBe(false);
  });

  it("calls a nought burn valued when nobody logged anything", () => {
    const readings = projectCreepReadings(burn(0, 1_000_000, UNRATED), []);

    expect(readings.burnValued).toBe(true);
  });
});

describe("the delivery half of the readings", () => {
  it("carries the delivered share of the sized work", () => {
    const readings = projectCreepReadings(burn(0, 1_000_000), [
      line(600, "done"),
      line(1_800),
    ]);

    expect(readings.deliveredShare).toBeCloseTo(0.25);
  });

  it("has no share when nothing was estimated", () => {
    const readings = projectCreepReadings(burn(0, 1_000_000), [
      line(0),
      line(0),
    ]);

    expect(readings.deliveredShare).toBeNull();
  });

  it("counts the lines, so a one-line list can be told apart", () => {
    expect(projectCreepReadings(burn(0, 1_000_000), [line(600)]).lineCount).toBe(
      1,
    );
    expect(projectCreepReadings(burn(0, 1_000_000), []).lineCount).toBe(0);
  });

  it("counts the lines nobody sized", () => {
    const readings = projectCreepReadings(burn(0, 1_000_000), [
      line(600),
      line(0),
      line(0, "done"),
    ]);

    expect(readings.unestimatedCount).toBe(2);
    expect(readings.unestimatedDeliveredCount).toBe(1);
  });

  it("counts the estimates below zero no form would have written", () => {
    const readings = projectCreepReadings(burn(0, 1_000_000), [
      line(600),
      line(-240),
    ]);

    expect(readings.negativeEstimateCount).toBe(1);
  });

  it("says when every line of the list is delivered", () => {
    const all = [line(600, "done"), line(1_800, "done")];

    expect(projectCreepReadings(burn(0, 1_000_000), all).scopeDelivered).toBe(
      true,
    );
  });

  it("does not call an empty list delivered", () => {
    expect(projectCreepReadings(burn(0, 1_000_000), []).scopeDelivered).toBe(
      false,
    );
  });

  it("does not call a started line delivered", () => {
    const readings = projectCreepReadings(burn(0, 1_000_000), [
      line(600, "started"),
    ]);

    expect(readings.scopeDelivered).toBe(false);
    expect(readings.deliveredShare).toBe(0);
  });
});

describe("assessing a project in one call", () => {
  it("catches high burn against low completion", () => {
    // $6,000 of a $10,000 contract, and not one of the three lines done.
    const assessment = assessProjectCreep(burn(1_800, 1_000_000), [
      line(300),
      line(2_400),
      line(300),
    ], DEFAULT_CREEP_THRESHOLDS);

    expect(assessment.health).toBe("over");
    expect(assessment.reasons).toEqual(["burn-far-ahead-of-delivery"]);
    expect(assessment.gap).toBeCloseTo(0.6);
    expect(assessment.blindSpots).toEqual([]);
  });

  it("calls a project tracking its delivery healthy", () => {
    const assessment = assessProjectCreep(burn(1_800, 1_000_000), [
      line(1_800, "done"),
      line(1_200),
    ], DEFAULT_CREEP_THRESHOLDS);

    expect(assessment.health).toBe("healthy");
    expect(assessment.reasons).toEqual([]);
  });

  it("withholds a verdict when the hours could not be valued", () => {
    const assessment = assessProjectCreep(burn(1_800, 1_000_000, UNRATED), [
      line(1_800, "done"),
    ], DEFAULT_CREEP_THRESHOLDS);

    expect(assessment.health).toBeNull();
    expect(assessment.consumedShare).toBeNull();
    expect(assessment.blindSpots).toContain("burn-not-valued");
  });

  it("still reads the money axis with nothing estimated", () => {
    const assessment = assessProjectCreep(
      burn(3_000, 1_000_000),
      [line(0)],
      DEFAULT_CREEP_THRESHOLDS,
    );

    expect(assessment.health).toBe("over");
    expect(assessment.reasons).toEqual(["contract-overspent"]);
    expect(assessment.blindSpots).toEqual(["scope-not-estimated"]);
  });
});
