import { describe, expect, it } from "vitest";

import type { EffectiveRate } from "@/lib/rates";

import {
  forecastBurn,
  type ForecastBasis,
  daysToBurn,
  FORECAST_HORIZON_DAYS,
  forecastDate,
  remainingWorkCents,
} from "./forecast";

/** $120.00 an hour, set on the project. */
const RATE: EffectiveRate = { cents: 12_000, source: "project" };

describe("remainingWorkCents", () => {
  it("values the unfinished estimates at the project's rate", () => {
    // Ten hours still to do at $120.00 an hour.
    expect(remainingWorkCents(600, RATE)).toBe(120_000);
  });

  it("rounds the part-hour the way an invoice line would", () => {
    expect(remainingWorkCents(80, RATE)).toBe(16_000);
    expect(remainingWorkCents(1, RATE)).toBe(200);
  });

  it("is nothing when there is no work left", () => {
    expect(remainingWorkCents(0, RATE)).toBe(0);
  });

  it("is nothing when the rate cannot value anything", () => {
    expect(remainingWorkCents(600, { cents: 0, source: "none" })).toBe(0);
  });

  it("carries a hand-edited negative estimate through rather than clamping", () => {
    expect(remainingWorkCents(-600, RATE)).toBe(-120_000);
  });

  it("is handed the total rather than valuing each line in turn", () => {
    // Three twenty-minute lines at $100.00 an hour come to an hour, not to
    // the cent less that valuing each of them separately would give.
    const hourly: EffectiveRate = { cents: 10_000, source: "project" };
    expect(remainingWorkCents(60, hourly)).toBe(10_000);
    expect(remainingWorkCents(20, hourly) * 3).toBe(9_999);
  });
});

describe("daysToBurn", () => {
  it("divides the amount by the pace", () => {
    expect(daysToBurn(70_000, 10_000)).toBe(7);
  });

  it("rounds a part day up", () => {
    // A date rounded down would arrive a day before the money ran out.
    expect(daysToBurn(70_001, 10_000)).toBe(8);
    expect(daysToBurn(1, 10_000)).toBe(1);
  });

  it("is today for an amount of nothing", () => {
    // A project with no work left finishes now, not at some point in the past.
    expect(daysToBurn(0, 10_000)).toBe(0);
  });

  it("is today for a budget already overspent", () => {
    // It ran out in the past, and the overrun figure says by how much in
    // cents. Counting backwards would date it from a pace that has moved.
    expect(daysToBurn(-50_000, 10_000)).toBe(0);
  });

  it("has no answer at a pace of nothing", () => {
    // Never, not in a very long time — and infinity is not a number of days.
    expect(daysToBurn(70_000, 0)).toBeNull();
  });

  it("has no answer at a pace that runs backwards", () => {
    expect(daysToBurn(70_000, -10_000)).toBeNull();
  });

  it("takes a fractional pace without rounding it first", () => {
    // The pace is a ratio, so it arrives unrounded: $33.33 a day over three
    // days reaches $100.00 on the third.
    expect(daysToBurn(10_000, 10_000 / 3)).toBe(3);
  });
});

describe("forecastDate", () => {
  it("lands the day count on the calendar", () => {
    expect(forecastDate("2026-03-14", 7)).toBe("2026-03-21");
  });

  it("is today itself for a count of nothing", () => {
    expect(forecastDate("2026-03-14", 0)).toBe("2026-03-14");
  });

  it("crosses a month and a year end", () => {
    expect(forecastDate("2026-03-30", 3)).toBe("2026-04-02");
    expect(forecastDate("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("names a date right up to the horizon", () => {
    expect(forecastDate("2026-03-14", FORECAST_HORIZON_DAYS)).toBe(
      "2036-03-11",
    );
  });

  it("names no date past the horizon", () => {
    // Not a clamped date at the horizon, which would read as a forecast of
    // that date: what is known is "not within ten years".
    expect(forecastDate("2026-03-14", FORECAST_HORIZON_DAYS + 1)).toBeNull();
  });

  it("names no date for a count that would land in the past", () => {
    expect(forecastDate("2026-03-14", -1)).toBeNull();
  });

  it("does not throw on a projection of millions of days", () => {
    // The whole reason for the cap: a page with one surprising estimate on it
    // should not be a page that fails to render.
    expect(forecastDate("2026-03-14", 50_000_000)).toBeNull();
  });

  it("refuses a today that is not a calendar date", () => {
    expect(() => forecastDate("2026-03-14T09:00:00.000Z", 7)).toThrow(
      "not a calendar date",
    );
  });
});

/**
 * A project halfway through a $10,000.00 contract: $4,000.00 burned, another
 * $4,000.00 of estimates still to work through, at $200.00 a day.
 */
function basis(overrides: Partial<ForecastBasis> = {}): ForecastBasis {
  return {
    today: "2026-03-14",
    contractedCents: 1_000_000,
    burnedCents: 400_000,
    remainingWorkCents: 400_000,
    centsPerDay: 20_000,
    ...overrides,
  };
}

describe("forecastBurn", () => {
  it("adds what is left to do to what has gone already", () => {
    expect(forecastBurn(basis()).projectedFinalCents).toBe(800_000);
  });

  it("reports no overage for a project that lands inside its contract", () => {
    expect(forecastBurn(basis()).projectedOverageCents).toBe(0);
  });

  it("reports what is left of the contract at the end, with its sign", () => {
    expect(forecastBurn(basis()).projectedRemainingCents).toBe(200_000);
  });

  it("works out the overage when the remaining work passes the price", () => {
    // $4,000.00 burned and $8,000.00 still to do on a $10,000.00 contract.
    const forecast = forecastBurn(basis({ remainingWorkCents: 800_000 }));
    expect(forecast.projectedFinalCents).toBe(1_200_000);
    expect(forecast.projectedOverageCents).toBe(200_000);
    expect(forecast.projectedRemainingCents).toBe(-200_000);
  });

  it("reports the projected share of the contract", () => {
    expect(forecastBurn(basis()).projectedShare).toBeCloseTo(0.8, 6);
    expect(
      forecastBurn(basis({ remainingWorkCents: 800_000 })).projectedShare,
    ).toBeCloseTo(1.2, 6);
  });

  it("has no share to report when nothing set a price", () => {
    // The same reading `consumedShare` takes: a share of nought is a gap, not
    // a measurement, and infinity is not a percentage.
    expect(
      forecastBurn(basis({ contractedCents: 0 })).projectedShare,
    ).toBeNull();
  });

  it("counts the whole remaining cost as overage when there is no price", () => {
    // Arithmetically true and useless to say out loud, which is why the panel
    // asks whether there is a price before it prints this.
    expect(
      forecastBurn(basis({ contractedCents: 0 })).projectedOverageCents,
    ).toBe(800_000);
  });

  it("projects a project with nothing left to do at what it has cost", () => {
    const forecast = forecastBurn(basis({ remainingWorkCents: 0 }));
    expect(forecast.projectedFinalCents).toBe(400_000);
    expect(forecast.projectedOverageCents).toBe(0);
  });

  it("projects a project already past its price as still over", () => {
    const forecast = forecastBurn(
      basis({ burnedCents: 1_200_000, remainingWorkCents: 0 }),
    );
    expect(forecast.projectedOverageCents).toBe(200_000);
    expect(forecast.projectedShare).toBeCloseTo(1.2, 6);
  });
});
