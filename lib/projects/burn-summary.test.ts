import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { UNRATED, type EffectiveRate } from "@/lib/rates";
import type { LoggedTotals } from "@/lib/time/rollup";

import { hasBurnToShow } from "./burn-summary";

/** The common case: a rate set on the project itself. */
const AT_150: EffectiveRate = { cents: 15_000, source: "project" };

/** Logged totals with the chargeable half defaulting to all of it. */
function logged(
  loggedMinutes: number,
  partial: Partial<LoggedTotals> = {},
): LoggedTotals {
  return {
    entryCount: loggedMinutes === 0 ? 0 : 1,
    loggedMinutes,
    billableMinutes: loggedMinutes,
    ...partial,
  };
}

/** A burn over the three things it is made of, so each test varies one. */
function burn(
  loggedMinutes: number,
  contractedCents: number,
  rate: EffectiveRate = AT_150,
  totals: Partial<LoggedTotals> = {},
): BurnSummary {
  return summariseBurn(logged(loggedMinutes, totals), contractedCents, rate);
}

describe("hasBurnToShow", () => {
  it("shows a burn once time has been logged", () => {
    expect(hasBurnToShow(burn(90, 500_000))).toBe(true);
  });

  it("shows the opening state of a priced project with no hours yet", () => {
    expect(hasBurnToShow(burn(0, 500_000))).toBe(true);
  });

  it("shows a burn against no price, which is the overrun worth seeing", () => {
    expect(hasBurnToShow(burn(90, 0))).toBe(true);
  });

  it("stays away from a project with no price and no hours", () => {
    expect(hasBurnToShow(burn(0, 0))).toBe(false);
  });

  it("shows an unrated project that has hours, so the gap can be named", () => {
    expect(hasBurnToShow(burn(90, 0, UNRATED))).toBe(true);
  });
});
