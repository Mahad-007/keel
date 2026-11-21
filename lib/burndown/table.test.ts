import { describe, expect, it } from "vitest";

import { burnDownReading, type BurnReading } from "./reading";
import { BURN_DOWN_COLUMNS, burnDownRow, burnDownRows } from "./table";

/** One day's reading of a $5,000 engagement. */
function reading(
  onDate: string,
  burnedCents = 0,
  overrides: { loggedMinutes?: number; origin?: string } = {},
): BurnReading {
  return burnDownReading({
    onDate,
    contractValueCents: 500_000,
    rateCents: 12_000,
    rateSource: "project",
    entryCount: 1,
    loggedMinutes: overrides.loggedMinutes ?? 60,
    billableMinutes: overrides.loggedMinutes ?? 60,
    burnedCents,
    chargeableCents: burnedCents,
    origin: overrides.origin ?? "recorded",
  });
}

describe("burnDownRow", () => {
  it("writes the day, the hours and both amounts", () => {
    expect(
      burnDownRow(reading("2026-03-04", 250_000, { loggedMinutes: 1_250 })),
    ).toEqual({
      onDate: "2026-03-04",
      day: "Mar 4, 2026",
      logged: "20h 50m",
      burned: "$2,500.00",
      left: "$2,500.00",
      reading: "Measured",
    });
  });

  it("names a reconstructed reading as one", () => {
    expect(burnDownRow(reading("2026-03-04", 0, { origin: "backfilled" })).reading).toBe(
      "Reconstructed",
    );
  });

  it("names a reading with an unreadable origin as a reconstruction", () => {
    expect(burnDownRow(reading("2026-03-04", 0, { origin: "guessed" })).reading).toBe(
      "Reconstructed",
    );
  });

  it("shows an overrun as the negative amount left that it is", () => {
    // The chart says "$1,200.00 over"; the table is the precise figure, and
    // the sign is what makes it precise.
    expect(burnDownRow(reading("2026-03-04", 620_000)).left).toBe(
      "-$1,200.00",
    );
  });

  it("reports the running total, not the day's own work", () => {
    const row = burnDownRow(
      reading("2026-03-31", 480_000, { loggedMinutes: 2_400 }),
    );
    expect(row.logged).toBe("40h");
    expect(row.burned).toBe("$4,800.00");
  });

  it("has a column heading for every cell it writes", () => {
    const row = burnDownRow(reading("2026-03-04"));
    for (const key of Object.keys(BURN_DOWN_COLUMNS)) {
      expect(row).toHaveProperty(key);
    }
  });
});

describe("burnDownRows", () => {
  it("puts the newest reading at the top, where attention goes", () => {
    expect(
      burnDownRows([
        reading("2026-03-01"),
        reading("2026-03-16"),
        reading("2026-03-31"),
      ]).map((row) => row.onDate),
    ).toEqual(["2026-03-31", "2026-03-16", "2026-03-01"]);
  });

  it("has no rows for a project with no readings", () => {
    expect(burnDownRows([])).toEqual([]);
  });

  it("does not disturb the readings it was handed", () => {
    const readings = [reading("2026-03-01"), reading("2026-03-31")];
    burnDownRows(readings);
    expect(readings.map((r) => r.onDate)).toEqual([
      "2026-03-01",
      "2026-03-31",
    ]);
  });
});
