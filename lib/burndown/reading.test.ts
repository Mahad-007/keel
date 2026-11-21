import { describe, expect, it } from "vitest";

import {
  burnDownReading,
  burnDownReadings,
  reconstructedRuns,
  type StoredBurnReading,
} from "./reading";

/** A day's stored row, as the table holds it. */
function stored(overrides: Partial<StoredBurnReading> = {}): StoredBurnReading {
  return {
    onDate: "2026-03-04",
    contractValueCents: 500_000,
    rateCents: 12_000,
    rateSource: "project",
    entryCount: 3,
    loggedMinutes: 600,
    billableMinutes: 540,
    burnedCents: 120_000,
    chargeableCents: 108_000,
    origin: "recorded",
    ...overrides,
  };
}

describe("burnDownReading", () => {
  it("keeps the day and the figures the row recorded", () => {
    expect(burnDownReading(stored())).toMatchObject({
      onDate: "2026-03-04",
      contractedCents: 500_000,
      rate: { cents: 12_000, source: "project" },
      loggedMinutes: 600,
      burnedCents: 120_000,
      chargeableCents: 108_000,
    });
  });

  it("works out what was left and what share had gone", () => {
    const reading = burnDownReading(stored());
    expect(reading.remainingCents).toBe(380_000);
    expect(reading.consumedShare).toBeCloseTo(0.24);
  });

  it("reports a measured day as measured", () => {
    expect(burnDownReading(stored()).origin).toBe("recorded");
  });

  it("reports a reconstructed day as reconstructed", () => {
    expect(burnDownReading(stored({ origin: "backfilled" })).origin).toBe(
      "backfilled",
    );
  });

  it("treats an origin the table does not know as a reconstruction", () => {
    // The weaker claim, because a hand-written row is the last one to vouch
    // for: an unreadable origin caveats a point rather than endorsing it.
    expect(burnDownReading(stored({ origin: "guessed" })).origin).toBe(
      "backfilled",
    );
    expect(burnDownReading(stored({ origin: "Recorded" })).origin).toBe(
      "backfilled",
    );
    expect(burnDownReading(stored({ origin: "" })).origin).toBe("backfilled");
  });

  it("shows the burn the row holds rather than recomputing it", () => {
    // Ten hours at $120 is $1,200, and the row says otherwise. The row wins:
    // the figure was reported, and a point that quietly corrected it would
    // hide the edit rather than show it.
    const reading = burnDownReading(stored({ burnedCents: 999_99 }));
    expect(reading.burnedCents).toBe(999_99);
    expect(reading.remainingCents).toBe(400_001);
  });

  it("carries a project that burned past its price below zero", () => {
    const reading = burnDownReading(stored({ burnedCents: 650_000 }));
    expect(reading.remainingCents).toBe(-150_000);
    expect(reading.consumedShare).toBeCloseTo(1.3);
  });
});

describe("burnDownReadings", () => {
  it("reads every row as a reading", () => {
    const readings = burnDownReadings([
      stored({ onDate: "2026-03-01", burnedCents: 60_000 }),
      stored({ onDate: "2026-03-04", burnedCents: 120_000 }),
    ]);
    expect(readings.map((r) => [r.onDate, r.remainingCents])).toEqual([
      ["2026-03-01", 440_000],
      ["2026-03-04", 380_000],
    ]);
  });

  it("puts the oldest reading first whatever order it arrived in", () => {
    const readings = burnDownReadings([
      stored({ onDate: "2026-03-04" }),
      stored({ onDate: "2026-01-09" }),
      stored({ onDate: "2026-03-01" }),
    ]);
    expect(readings.map((r) => r.onDate)).toEqual([
      "2026-01-09",
      "2026-03-01",
      "2026-03-04",
    ]);
  });

  it("drops a row whose day is not a day, and keeps the rest", () => {
    const readings = burnDownReadings([
      stored({ onDate: "2026-03-01" }),
      stored({ onDate: "2026-02-30" }),
      stored({ onDate: "not a day" }),
      stored({ onDate: "2026-03-04T09:00:00.000Z" }),
      stored({ onDate: "2026-03-04" }),
    ]);
    expect(readings.map((r) => r.onDate)).toEqual(["2026-03-01", "2026-03-04"]);
  });

  it("has nothing to say about a project with no readings", () => {
    expect(burnDownReadings([])).toEqual([]);
  });

  it("keeps each reading's own origin through the sort", () => {
    const readings = burnDownReadings([
      stored({ onDate: "2026-03-04", origin: "recorded" }),
      stored({ onDate: "2026-03-01", origin: "backfilled" }),
    ]);
    expect(readings.map((r) => r.origin)).toEqual(["backfilled", "recorded"]);
  });
});

describe("reconstructedRuns", () => {
  /** A line of readings, each named by the day and how it was arrived at. */
  function line(days: readonly [string, string][]) {
    return burnDownReadings(
      days.map(([onDate, origin]) => stored({ onDate, origin })),
    );
  }

  it("finds the reconstructed stretch at the start of a line", () => {
    expect(
      reconstructedRuns(
        line([
          ["2026-03-01", "backfilled"],
          ["2026-03-02", "backfilled"],
          ["2026-03-05", "recorded"],
        ]),
      ),
    ).toEqual([{ from: "2026-03-01", to: "2026-03-02" }]);
  });

  it("finds nothing on a line that was measured throughout", () => {
    expect(
      reconstructedRuns(
        line([
          ["2026-03-01", "recorded"],
          ["2026-03-02", "recorded"],
        ]),
      ),
    ).toEqual([]);
  });

  it("marks a whole line that was reconstructed throughout", () => {
    expect(
      reconstructedRuns(
        line([
          ["2026-03-01", "backfilled"],
          ["2026-03-31", "backfilled"],
        ]),
      ),
    ).toEqual([{ from: "2026-03-01", to: "2026-03-31" }]);
  });

  it("keeps a gap repaired later apart from the one at the start", () => {
    expect(
      reconstructedRuns(
        line([
          ["2026-03-01", "backfilled"],
          ["2026-03-02", "backfilled"],
          ["2026-03-05", "recorded"],
          ["2026-03-06", "backfilled"],
          ["2026-03-09", "recorded"],
        ]),
      ),
    ).toEqual([
      { from: "2026-03-01", to: "2026-03-02" },
      { from: "2026-03-06", to: "2026-03-06" },
    ]);
  });

  it("gives a single reconstructed day a stretch of one", () => {
    expect(
      reconstructedRuns(line([["2026-03-06", "backfilled"]])),
    ).toEqual([{ from: "2026-03-06", to: "2026-03-06" }]);
  });

  it("holds a run across a month nothing was logged in", () => {
    // The line across that gap is drawn from the figures of the first day,
    // and those figures are the reconstruction.
    expect(
      reconstructedRuns(
        line([
          ["2026-03-01", "backfilled"],
          ["2026-04-30", "backfilled"],
          ["2026-05-01", "recorded"],
        ]),
      ),
    ).toEqual([{ from: "2026-03-01", to: "2026-04-30" }]);
  });

  it("has nothing to mark on an empty line", () => {
    expect(reconstructedRuns([])).toEqual([]);
  });
});
