import { describe, expect, it } from "vitest";

import type { BurnReading } from "@/lib/burndown/reading";
import { inclusiveDayCount } from "@/lib/dates";

import {
  type BurnRate,
  centsPerDay,
  classifyPaceShift,
  forecastPace,
  hasBurnRate,
  overallBurnRate,
  paceChangeRatio,
  PACE_SHIFT_THRESHOLD,
  rateWindowStart,
  recentBurnRate,
  windowCoversWholeHistory,
  RECENT_RATE_WINDOW_DAYS,
} from "./rate";

/**
 * A stored reading, as the chart gets it.
 *
 * `burnedCents` is the cumulative total at the end of the day, which is what
 * the rate arithmetic reads; the rest is carried so the literal satisfies the
 * type without every test having to care about it.
 */
function reading(
  onDate: string,
  burnedCents: number,
  overrides: Partial<BurnReading> = {},
): BurnReading {
  return {
    onDate,
    contractedCents: 1_000_000,
    rate: { cents: 12_000, source: "project" },
    entryCount: 1,
    loggedMinutes: Math.round((burnedCents * 60) / 12_000),
    billableMinutes: Math.round((burnedCents * 60) / 12_000),
    burnedCents,
    chargeableCents: burnedCents,
    remainingCents: 1_000_000 - burnedCents,
    consumedShare: burnedCents / 1_000_000,
    origin: "recorded",
    ...overrides,
  };
}

describe("centsPerDay", () => {
  it("divides the burn over the days it took", () => {
    expect(centsPerDay(70_000, 7)).toBe(10_000);
  });

  it("is the whole burn for a span of one day", () => {
    expect(centsPerDay(12_000, 1)).toBe(12_000);
  });

  it("leaves the quotient unrounded", () => {
    // A ratio, not an amount: rounding here and multiplying by ninety days
    // downstream would compound a half-cent into real money.
    expect(centsPerDay(10_000, 3)).toBeCloseTo(3333.333, 3);
  });

  it("reports no pace for a span of no days", () => {
    expect(centsPerDay(70_000, 0)).toBeNull();
  });

  it("reports no pace for a span measured backwards", () => {
    expect(centsPerDay(70_000, -2)).toBeNull();
  });

  it("is nought for a span nothing was burned across", () => {
    // A measurement, not a gap: these days happened and nobody worked.
    expect(centsPerDay(0, 14)).toBe(0);
  });

  it("carries a burn that went backwards through as a negative pace", () => {
    // An entry deleted between two readings. Visible rather than clamped —
    // a project whose burn fell is a fact, not a project that stood still.
    expect(centsPerDay(-14_000, 7)).toBe(-2000);
  });
});

describe("overallBurnRate", () => {
  it("divides the cumulative burn by the days it was spread over", () => {
    // Four days, both ends counted, and $400.00 burned across them.
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-04", 40_000),
    ]);
    expect(rate).toMatchObject({
      fromDate: "2026-03-01",
      toDate: "2026-03-04",
      elapsedDays: 4,
      burnedCents: 40_000,
      centsPerDay: 10_000,
      readingCount: 2,
    });
  });

  it("baselines at nought rather than at the first reading", () => {
    // The first reading already holds the first day's work. Subtracting it
    // would report $300.00 over four days instead of $400.00.
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-04", 40_000),
    ]);
    expect(rate?.burnedCents).toBe(40_000);
  });

  it("reads a single reading as one day at its own figure", () => {
    const rate = overallBurnRate([reading("2026-03-01", 12_000)]);
    expect(rate).toMatchObject({
      fromDate: "2026-03-01",
      toDate: "2026-03-01",
      elapsedDays: 1,
      centsPerDay: 12_000,
      readingCount: 1,
    });
  });

  it("counts the idle days between readings, not just the ones with rows", () => {
    // Worked on the first and the thirty-first and not in between: the pace
    // is spread across the whole month, because the money was.
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-31", 40_000),
    ]);
    expect(rate?.elapsedDays).toBe(31);
    expect(rate?.centsPerDay).toBeCloseTo(1290.32, 2);
  });

  it("counts every reading it was handed, not just the ends", () => {
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-02", 20_000),
      reading("2026-03-03", 30_000),
    ]);
    expect(rate?.readingCount).toBe(3);
  });

  it("reports no pace at all for a project with no readings", () => {
    // No pace, as opposed to a pace of nothing: a forecast from nought would
    // promise the contract lasts for ever.
    expect(overallBurnRate([])).toBeNull();
  });

  it("reports a pace of nothing when nothing has been burned", () => {
    // Days with readings and no money against them. A measurement, so the
    // rate exists and says nought; `hasBurnRate` is what refuses to use it.
    const rate = overallBurnRate([
      reading("2026-03-01", 0),
      reading("2026-03-04", 0),
    ]);
    expect(rate?.centsPerDay).toBe(0);
  });

  it("reads the pace off the last reading however many come before it", () => {
    const rate = overallBurnRate([
      reading("2026-03-01", 10_000),
      reading("2026-03-02", 10_000),
      reading("2026-03-02", 25_000),
    ]);
    expect(rate?.burnedCents).toBe(25_000);
    expect(rate?.elapsedDays).toBe(2);
  });
});

describe("hasBurnRate", () => {
  it("accepts a pace above nothing", () => {
    expect(hasBurnRate(overallBurnRate([reading("2026-03-01", 12_000)]))).toBe(
      true,
    );
  });

  it("refuses a pace of nothing", () => {
    // Infinity downstream: the contract would last for ever and the project
    // with unvalued hours would be the one with nothing to worry about.
    expect(hasBurnRate(overallBurnRate([reading("2026-03-01", 0)]))).toBe(
      false,
    );
  });

  it("refuses a pace that runs backwards", () => {
    expect(hasBurnRate(overallBurnRate([reading("2026-03-01", -500)]))).toBe(
      false,
    );
  });

  it("refuses an absent pace", () => {
    expect(hasBurnRate(null)).toBe(false);
  });
});

describe("rateWindowStart", () => {
  it("counts both ends of the window", () => {
    // A fortnight ending on the 14th starts on the 1st, not the previous
    // month: shifting back the whole window would cover fifteen days.
    expect(rateWindowStart("2026-03-14", 14)).toBe("2026-03-01");
  });

  it("is the day itself for a window of one", () => {
    expect(rateWindowStart("2026-03-14", 1)).toBe("2026-03-14");
  });

  it("reaches back across a month boundary", () => {
    expect(rateWindowStart("2026-03-05", 14)).toBe("2026-02-20");
  });

  it("reaches back across a leap day", () => {
    expect(rateWindowStart("2024-03-01", 3)).toBe("2024-02-28");
  });

  it("refuses a window of no days", () => {
    expect(() => rateWindowStart("2026-03-14", 0)).toThrow(
      "not a window of whole days",
    );
  });

  it("refuses a window that runs forwards", () => {
    expect(() => rateWindowStart("2026-03-14", -7)).toThrow(
      "not a window of whole days",
    );
  });

  it("refuses a window of part of a day", () => {
    expect(() => rateWindowStart("2026-03-14", 7.5)).toThrow(
      "not a window of whole days",
    );
  });

  it("covers the fortnight the default window promises", () => {
    expect(
      inclusiveDayCount(
        rateWindowStart("2026-03-14", RECENT_RATE_WINDOW_DAYS),
        "2026-03-14",
      ),
    ).toBe(RECENT_RATE_WINDOW_DAYS);
  });
});

describe("recentBurnRate", () => {
  it("measures the window ending at the last reading", () => {
    // Burn stood at $200.00 on the day the fortnight opened and $600.00 at
    // the end of it: $400.00 across fourteen days.
    const rate = recentBurnRate(
      [
        reading("2026-02-20", 20_000),
        reading("2026-03-01", 30_000),
        reading("2026-03-14", 60_000),
      ],
      14,
    );
    expect(rate).toMatchObject({
      fromDate: "2026-03-01",
      toDate: "2026-03-14",
      elapsedDays: 14,
      burnedCents: 40_000,
      centsPerDay: 40_000 / 14,
    });
  });

  it("baselines on the last reading before the window opened", () => {
    // The reading on the 20th is outside the window, so its figure is what
    // the window started from rather than part of what it burned.
    const rate = recentBurnRate(
      [reading("2026-02-20", 50_000), reading("2026-03-14", 60_000)],
      14,
    );
    expect(rate?.burnedCents).toBe(10_000);
  });

  it("counts only the readings inside the window", () => {
    const rate = recentBurnRate(
      [
        reading("2026-02-10", 10_000),
        reading("2026-02-20", 20_000),
        reading("2026-03-02", 30_000),
        reading("2026-03-14", 60_000),
      ],
      14,
    );
    expect(rate?.readingCount).toBe(2);
  });

  it("ends at the last reading even when it is months old", () => {
    // A window ending today would be empty, and an empty window would
    // silently withdraw the forecast from the project nobody has looked at.
    const rate = recentBurnRate(
      [reading("2025-11-01", 10_000), reading("2025-11-14", 40_000)],
      14,
    );
    expect(rate).toMatchObject({
      fromDate: "2025-11-01",
      toDate: "2025-11-14",
      elapsedDays: 14,
    });
  });

  it("does not reach back past the first reading", () => {
    // Five days old, so measured over five days. Dividing by fourteen would
    // report a third of the real pace — wrong in the reassuring direction.
    const rate = recentBurnRate(
      [reading("2026-03-10", 10_000), reading("2026-03-14", 50_000)],
      14,
    );
    expect(rate).toMatchObject({
      fromDate: "2026-03-10",
      elapsedDays: 5,
      burnedCents: 50_000,
      centsPerDay: 10_000,
    });
  });

  it("is the same reading as the overall pace below the window length", () => {
    const readings = [
      reading("2026-03-10", 10_000),
      reading("2026-03-14", 50_000),
    ];
    expect(recentBurnRate(readings, 14)).toEqual(overallBurnRate(readings));
  });

  it("includes a reading dated exactly on the day the window opens", () => {
    const rate = recentBurnRate(
      [
        reading("2026-03-01", 10_000),
        reading("2026-03-02", 20_000),
        reading("2026-03-14", 60_000),
      ],
      14,
    );
    // The first of March opens the window, so its figure is burned inside it.
    expect(rate?.burnedCents).toBe(60_000);
    expect(rate?.readingCount).toBe(3);
  });

  it("reports no pace at all for a project with no readings", () => {
    expect(recentBurnRate([], 14)).toBeNull();
  });

  it("reports a pace of nothing for a window nothing moved in", () => {
    // Work three weeks ago and none since. A real slowdown, and the figure
    // says so rather than carrying the old pace forward.
    const rate = recentBurnRate(
      [reading("2026-02-10", 50_000), reading("2026-03-14", 50_000)],
      14,
    );
    expect(rate?.centsPerDay).toBe(0);
    expect(hasBurnRate(rate)).toBe(false);
  });

  /**
   * The window is an argument with no default, so there is no such thing as
   * "the fortnight" inside this function — a fortnight is what the spec
   * publishes when nobody has configured anything, and the test that pins that
   * belongs with the spec. What is worth asserting here is that the figure is
   * actually used: a window twice as long reaches back past a reading the
   * shorter one excluded, and the pace changes accordingly.
   */
  it("measures over the window it is given, whatever it is", () => {
    const readings = [
      reading("2026-02-20", 20_000),
      reading("2026-03-01", 30_000),
      reading("2026-03-14", 60_000),
    ];

    expect(recentBurnRate(readings, 14)?.fromDate).toBe("2026-03-01");
    expect(recentBurnRate(readings, 30)?.fromDate).toBe("2026-02-20");
  });
});

/** A fortnight at nearly twice the pace of the two months before it. */
const ACCELERATING: BurnReading[] = [
  reading("2026-01-15", 10_000),
  reading("2026-02-28", 60_000),
  reading("2026-03-14", 110_000),
];

describe("paceChangeRatio", () => {
  it("divides the recent pace by the overall one", () => {
    const overall = overallBurnRate(ACCELERATING);
    const recent = recentBurnRate(ACCELERATING, 14);
    expect(paceChangeRatio(overall, recent)).toBeCloseTo(
      (recent?.centsPerDay ?? 0) / (overall?.centsPerDay ?? 1),
      6,
    );
  });

  it("reports a project burning faster than its average above one", () => {
    expect(
      paceChangeRatio(
        overallBurnRate(ACCELERATING),
        recentBurnRate(ACCELERATING, 14),
      ),
    ).toBeGreaterThan(1.9);
  });

  it("reports a project that has gone quiet below one", () => {
    const slowing = [
      reading("2026-01-15", 10_000),
      reading("2026-02-28", 100_000),
      reading("2026-03-14", 105_000),
    ];
    expect(
      paceChangeRatio(overallBurnRate(slowing), recentBurnRate(slowing, 14)),
    ).toBeLessThan(0.5);
  });

  it("is one when the window covers the whole history", () => {
    const young = [reading("2026-03-10", 10_000), reading("2026-03-14", 50_000)];
    expect(
      paceChangeRatio(overallBurnRate(young), recentBurnRate(young, 14)),
    ).toBe(1);
  });

  it("has no ratio when either pace is missing", () => {
    expect(paceChangeRatio(null, recentBurnRate(ACCELERATING, 14))).toBeNull();
    expect(paceChangeRatio(overallBurnRate(ACCELERATING), null)).toBeNull();
  });

  it("has no ratio when the overall pace is nothing", () => {
    // Infinity otherwise, and "only just started" is the honest reading.
    const flat = [reading("2026-03-01", 0), reading("2026-03-14", 5_000)];
    expect(
      paceChangeRatio(
        { ...(overallBurnRate(flat) as BurnRate), centsPerDay: 0 },
        recentBurnRate(flat, 14),
      ),
    ).toBeNull();
  });
});

describe("classifyPaceShift", () => {
  it("calls a pace within a quarter of its average steady", () => {
    expect(classifyPaceShift(1, PACE_SHIFT_THRESHOLD)).toBe("steady");
    expect(classifyPaceShift(1.1, PACE_SHIFT_THRESHOLD)).toBe("steady");
    expect(classifyPaceShift(0.9, PACE_SHIFT_THRESHOLD)).toBe("steady");
  });

  it("calls a pace a quarter or more above its average faster", () => {
    expect(
      classifyPaceShift(1 + PACE_SHIFT_THRESHOLD, PACE_SHIFT_THRESHOLD),
    ).toBe("faster");
    expect(classifyPaceShift(2, PACE_SHIFT_THRESHOLD)).toBe("faster");
  });

  it("calls a pace a quarter or more below its average slower", () => {
    expect(
      classifyPaceShift(1 - PACE_SHIFT_THRESHOLD, PACE_SHIFT_THRESHOLD),
    ).toBe("slower");
    expect(classifyPaceShift(0.1, PACE_SHIFT_THRESHOLD)).toBe("slower");
  });

  it("holds the line just inside the threshold either way", () => {
    expect(classifyPaceShift(1.2499, PACE_SHIFT_THRESHOLD)).toBe("steady");
    expect(classifyPaceShift(0.7501, PACE_SHIFT_THRESHOLD)).toBe("steady");
  });

  it("reads a window nothing moved in as slower rather than steady", () => {
    expect(classifyPaceShift(0, PACE_SHIFT_THRESHOLD)).toBe("slower");
  });

  it("reads a burn that went backwards as slower", () => {
    expect(classifyPaceShift(-0.4, PACE_SHIFT_THRESHOLD)).toBe("slower");
  });

  it("has no verdict when there is no ratio to judge", () => {
    // Not "steady": two paces agreeing is a measurement, and no second pace
    // to compare is a gap.
    expect(classifyPaceShift(null, PACE_SHIFT_THRESHOLD)).toBeNull();
  });

  it("calls an accelerating project faster from its own readings", () => {
    expect(
      classifyPaceShift(
        paceChangeRatio(
          overallBurnRate(ACCELERATING),
          recentBurnRate(ACCELERATING, 14),
        ),
        PACE_SHIFT_THRESHOLD,
      ),
    ).toBe("faster");
  });
});

describe("windowCoversWholeHistory", () => {
  it("is true for a project younger than the window", () => {
    const young = [reading("2026-03-10", 10_000), reading("2026-03-14", 50_000)];
    expect(
      windowCoversWholeHistory(
        overallBurnRate(young),
        recentBurnRate(young, 14),
      ),
    ).toBe(true);
  });

  it("is true for a project exactly as old as the window", () => {
    const exact = [reading("2026-03-01", 10_000), reading("2026-03-14", 50_000)];
    expect(
      windowCoversWholeHistory(
        overallBurnRate(exact),
        recentBurnRate(exact, 14),
      ),
    ).toBe(true);
  });

  it("is false once there is history outside the window", () => {
    expect(
      windowCoversWholeHistory(
        overallBurnRate(ACCELERATING),
        recentBurnRate(ACCELERATING, 14),
      ),
    ).toBe(false);
  });

  it("is false when either pace is missing", () => {
    expect(windowCoversWholeHistory(null, recentBurnRate(ACCELERATING, 14))).toBe(
      false,
    );
    expect(windowCoversWholeHistory(overallBurnRate(ACCELERATING), null)).toBe(
      false,
    );
  });

  it("separates one short reading from two spans agreeing", () => {
    const young = [reading("2026-03-10", 10_000), reading("2026-03-14", 50_000)];
    // Both ratios are one; only this predicate says which of them is a
    // corroboration and which is a single measurement reported twice.
    expect(
      paceChangeRatio(overallBurnRate(young), recentBurnRate(young, 14)),
    ).toBe(1);
    expect(
      windowCoversWholeHistory(
        overallBurnRate(young),
        recentBurnRate(young, 14),
      ),
    ).toBe(true);
  });
});

describe("forecastPace", () => {
  it("carries the recent pace forward when there is one", () => {
    const overall = overallBurnRate(ACCELERATING) as BurnRate;
    const recent = recentBurnRate(ACCELERATING, 14);
    expect(forecastPace(overall, recent)).toBe(recent);
  });

  it("falls back to the average when the window was quiet", () => {
    // The work in the scope list has not gone away because somebody took a
    // holiday, and "no projected finish" would be worse than the average.
    const quiet = [
      reading("2026-02-01", 10_000),
      reading("2026-02-10", 80_000),
      reading("2026-03-14", 80_000),
    ];
    const overall = overallBurnRate(quiet) as BurnRate;
    expect(recentBurnRate(quiet, 14)?.centsPerDay).toBe(0);
    expect(forecastPace(overall, recentBurnRate(quiet, 14))).toBe(overall);
  });

  it("falls back to the average when there is no recent pace at all", () => {
    const overall = overallBurnRate(ACCELERATING) as BurnRate;
    expect(forecastPace(overall, null)).toBe(overall);
  });

  it("always hands back a pace that is one of the two it was given", () => {
    const overall = overallBurnRate(ACCELERATING) as BurnRate;
    const recent = recentBurnRate(ACCELERATING, 14);
    expect([overall, recent]).toContain(forecastPace(overall, recent));
  });
});
