import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { UNRATED, type EffectiveRate } from "@/lib/rates";
import type { ScopeLine } from "@/lib/scope";

import { projectCreepReadings } from "./creep-readings";

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
    const readings = projectCreepReadings(burn(3_000, 1_000_000), []);

    expect(readings.consumedShare).toBeCloseTo(1);
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
