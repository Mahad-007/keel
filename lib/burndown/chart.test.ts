import { describe, expect, it } from "vitest";

import {
  BURN_CHART_BOX,
  burnChartArea,
  burnChartDomain,
} from "./chart";
import { burnDownReading, type BurnReading } from "./reading";

/**
 * One day's reading of a $5,000 engagement, with the burn as it stood.
 *
 * Built through `burnDownReading` rather than written out as a literal, so
 * what is left and the share consumed are the figures the reader of a stored
 * row would get rather than a second arithmetic agreeing with itself.
 */
function reading(
  onDate: string,
  burnedCents: number,
  overrides: { contractValueCents?: number; origin?: string } = {},
): BurnReading {
  return burnDownReading({
    onDate,
    contractValueCents: overrides.contractValueCents ?? 500_000,
    rateCents: 12_000,
    rateSource: "project",
    entryCount: 1,
    loggedMinutes: 60,
    billableMinutes: 60,
    burnedCents,
    chargeableCents: burnedCents,
    origin: overrides.origin ?? "recorded",
  });
}

describe("burnChartArea", () => {
  it("insets the plot by each margin of the box", () => {
    expect(burnChartArea()).toEqual({
      left: 68,
      right: 612,
      top: 16,
      bottom: 230,
      width: 544,
      height: 214,
    });
  });

  it("agrees with itself about where the edges are", () => {
    const area = burnChartArea();
    expect(area.right - area.left).toBe(area.width);
    expect(area.bottom - area.top).toBe(area.height);
  });

  it("keeps the plot inside the box on every side", () => {
    const area = burnChartArea();
    expect(area.left).toBeGreaterThan(0);
    expect(area.top).toBeGreaterThan(0);
    expect(area.right).toBeLessThan(BURN_CHART_BOX.width);
    expect(area.bottom).toBeLessThan(BURN_CHART_BOX.height);
  });

  it("leaves a plot to draw in whatever box it is given", () => {
    const area = burnChartArea({
      width: 400,
      height: 200,
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    });
    expect(area).toEqual({
      left: 40,
      right: 380,
      top: 10,
      bottom: 170,
      width: 340,
      height: 160,
    });
  });

  it("is wider than it is tall, so a slope reads as a slope", () => {
    const area = burnChartArea();
    expect(area.width).toBeGreaterThan(area.height * 2);
  });
});

describe("burnChartDomain", () => {
  it("spans the first reading to the last", () => {
    const domain = burnChartDomain([
      reading("2026-03-01", 0),
      reading("2026-03-04", 60_000),
      reading("2026-04-01", 120_000),
    ]);
    expect(domain).toMatchObject({
      from: "2026-03-01",
      to: "2026-04-01",
      days: 31,
    });
  });

  it("reaches from the contract value down to nothing left", () => {
    const domain = burnChartDomain([reading("2026-03-01", 60_000)]);
    expect(domain).toMatchObject({ topCents: 500_000, bottomCents: 0 });
  });

  it("holds the largest price a repriced project ever recorded", () => {
    const domain = burnChartDomain([
      reading("2026-03-01", 0, { contractValueCents: 800_000 }),
      reading("2026-03-04", 60_000, { contractValueCents: 500_000 }),
    ]);
    expect(domain?.topCents).toBe(800_000);
  });

  it("drops below zero for an engagement that burned past its price", () => {
    const domain = burnChartDomain([
      reading("2026-03-01", 100_000),
      reading("2026-03-04", 620_000),
    ]);
    expect(domain).toMatchObject({ topCents: 500_000, bottomCents: -120_000 });
  });

  it("is zero days wide for a project with one day of readings", () => {
    expect(burnChartDomain([reading("2026-03-01", 60_000)])?.days).toBe(0);
  });

  it("has nothing to draw against when there are no readings", () => {
    expect(burnChartDomain([])).toBeNull();
  });

  it("has nothing to draw against when no money ever moved", () => {
    // No price agreed and nothing burned: a flat line on the floor would be
    // the same picture as an engagement that spent none of a real budget.
    expect(
      burnChartDomain([
        reading("2026-03-01", 0, { contractValueCents: 0 }),
        reading("2026-03-04", 0, { contractValueCents: 0 }),
      ]),
    ).toBeNull();
  });

  it("draws a priceless project that burned anyway, below the line", () => {
    const domain = burnChartDomain([
      reading("2026-03-01", 40_000, { contractValueCents: 0 }),
    ]);
    expect(domain).toMatchObject({ topCents: 0, bottomCents: -40_000 });
  });

  it("keeps zero on the axis of a project priced below nothing", () => {
    // A hand-edited negative price. Zero is still where the money runs out,
    // and an axis that left it off would have no landmark at all.
    const domain = burnChartDomain([
      reading("2026-03-01", 0, { contractValueCents: -100_000 }),
    ]);
    expect(domain).toMatchObject({ topCents: 0, bottomCents: -100_000 });
  });
});
