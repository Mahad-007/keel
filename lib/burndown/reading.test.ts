import { describe, expect, it } from "vitest";

import { burnDownReading, type StoredBurnReading } from "./reading";

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
