import { describe, expect, it } from "vitest";

import {
  BURN_CHART_BOX,
  burnChartArea,
  burnChartDomain,
  burnChartX,
  burnChartY,
  burnAreaPath,
  burnLinePath,
  plotBurnReadings,
  burnDownChart,
  reconstructedBands,
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

describe("burnChartX", () => {
  const area = burnChartArea();
  const domain = burnChartDomain([
    reading("2026-03-01", 0),
    reading("2026-03-31", 60_000),
  ])!;

  it("puts the first day on the left edge of the plot", () => {
    expect(burnChartX("2026-03-01", domain, area)).toBe(area.left);
  });

  it("puts the last day on the right edge of the plot", () => {
    expect(burnChartX("2026-03-31", domain, area)).toBe(area.right);
  });

  it("puts the halfway day halfway across", () => {
    expect(burnChartX("2026-03-16", domain, area)).toBeCloseTo(
      area.left + area.width / 2,
    );
  });

  it("spaces two days by the calendar between them, not by their turn", () => {
    // Three readings, a day apart and then a month apart. The second sits
    // near the left edge because that is where it happened.
    const sparse = burnChartDomain([
      reading("2026-03-01", 0),
      reading("2026-03-02", 20_000),
      reading("2026-04-01", 60_000),
    ])!;
    const second = burnChartX("2026-03-02", sparse, area);
    expect(second).toBeCloseTo(area.left + area.width / 31);
    expect(second).toBeLessThan(area.left + area.width / 4);
  });

  it("centres the single point of a one-day project", () => {
    const oneDay = burnChartDomain([reading("2026-03-01", 60_000)])!;
    expect(burnChartX("2026-03-01", oneDay, area)).toBe(
      area.left + area.width / 2,
    );
  });

  it("leaves a day outside the domain outside the plot", () => {
    expect(burnChartX("2026-02-28", domain, area)).toBeLessThan(area.left);
    expect(burnChartX("2026-04-02", domain, area)).toBeGreaterThan(area.right);
  });

  it("refuses a day that is not a calendar date", () => {
    expect(() => burnChartX("not a day", domain, area)).toThrow(
      "not a calendar date",
    );
  });
});

describe("burnChartY", () => {
  const area = burnChartArea();
  const domain = burnChartDomain([reading("2026-03-01", 100_000)])!;

  it("puts the contract value at the top of the plot", () => {
    expect(burnChartY(500_000, domain, area)).toBe(area.top);
  });

  it("puts nothing left at the bottom of the plot", () => {
    expect(burnChartY(0, domain, area)).toBe(area.bottom);
  });

  it("puts half the contract halfway up", () => {
    expect(burnChartY(250_000, domain, area)).toBeCloseTo(
      area.top + area.height / 2,
    );
  });

  it("counts upwards: more money left is higher on the picture", () => {
    expect(burnChartY(400_000, domain, area)).toBeLessThan(
      burnChartY(100_000, domain, area),
    );
  });

  it("drops an overrun below the line it blew through", () => {
    const overrun = burnChartDomain([
      reading("2026-03-01", 100_000),
      reading("2026-03-04", 600_000),
    ])!;
    const zero = burnChartY(0, overrun, area);
    expect(burnChartY(-100_000, overrun, area)).toBeGreaterThan(zero);
    expect(burnChartY(-100_000, overrun, area)).toBe(area.bottom);
  });

  it("leaves an amount outside the domain outside the plot", () => {
    expect(burnChartY(600_000, domain, area)).toBeLessThan(area.top);
    expect(burnChartY(-1, domain, area)).toBeGreaterThan(area.bottom);
  });
});

describe("plotBurnReadings", () => {
  const area = burnChartArea();

  it("runs the line from the first day to the last", () => {
    const readings = [
      reading("2026-03-01", 0),
      reading("2026-03-16", 250_000),
      reading("2026-03-31", 500_000),
    ];
    const plotted = plotBurnReadings(readings, burnChartDomain(readings)!, area);
    expect(plotted.map((p) => p.x)).toEqual([area.left, 340, area.right]);
  });

  it("falls as the money goes", () => {
    const readings = [
      reading("2026-03-01", 0),
      reading("2026-03-16", 250_000),
      reading("2026-03-31", 500_000),
    ];
    const plotted = plotBurnReadings(readings, burnChartDomain(readings)!, area);
    expect(plotted.map((p) => p.y)).toEqual([area.top, 123, area.bottom]);
  });

  it("holds its height across a day where nothing was burned", () => {
    const readings = [
      reading("2026-03-01", 100_000),
      reading("2026-03-02", 100_000),
    ];
    const plotted = plotBurnReadings(readings, burnChartDomain(readings)!, area);
    expect(plotted[0].y).toBe(plotted[1].y);
  });

  it("carries the whole reading, so a label can be built from it", () => {
    const readings = [reading("2026-03-01", 100_000)];
    const [point] = plotBurnReadings(
      readings,
      burnChartDomain(readings)!,
      area,
    );
    expect(point.reading.onDate).toBe("2026-03-01");
    expect(point.reading.remainingCents).toBe(400_000);
  });

  it("rounds coordinates to the hundredth of a unit", () => {
    const readings = [
      reading("2026-03-01", 0),
      reading("2026-03-08", 123_457),
      reading("2026-03-22", 500_000),
    ];
    const plotted = plotBurnReadings(readings, burnChartDomain(readings)!, area);
    for (const { x, y } of plotted) {
      expect(x).toBe(Math.round(x * 100) / 100);
      expect(y).toBe(Math.round(y * 100) / 100);
    }
  });

  it("plots nothing for a project with no readings", () => {
    const domain = burnChartDomain([reading("2026-03-01", 100_000)])!;
    expect(plotBurnReadings([], domain, area)).toEqual([]);
  });
});

/** The readings plotted in the standard box, for the path builders. */
function plot(readings: readonly BurnReading[]) {
  const domain = burnChartDomain(readings);
  return domain === null
    ? []
    : plotBurnReadings(readings, domain, burnChartArea());
}

describe("burnLinePath", () => {
  it("moves to the first reading and draws to each one after it", () => {
    expect(
      burnLinePath(
        plot([
          reading("2026-03-01", 0),
          reading("2026-03-16", 250_000),
          reading("2026-03-31", 500_000),
        ]),
      ),
    ).toBe("M68 16 L340 123 L612 230");
  });

  it("joins the readings with straight segments and no curves", () => {
    const path = burnLinePath(
      plot([
        reading("2026-03-01", 0),
        reading("2026-03-10", 100_000),
        reading("2026-03-31", 500_000),
      ]),
    );
    expect(path).not.toMatch(/[CcSsQqTtAa]/);
    expect(path.match(/L/g)).toHaveLength(2);
  });

  it("draws nothing for a project with no readings", () => {
    expect(burnLinePath([])).toBe("");
  });

  it("is a bare move for a single reading, which is not a line", () => {
    expect(burnLinePath(plot([reading("2026-03-01", 100_000)]))).toBe(
      "M340 58.8",
    );
  });
});

describe("burnAreaPath", () => {
  it("closes the line down to the baseline and back", () => {
    const plotted = plot([
      reading("2026-03-01", 0),
      reading("2026-03-31", 250_000),
    ]);
    expect(burnAreaPath(plotted, 230)).toBe(
      "M68 16 L612 123 L612 230 L68 230 Z",
    );
  });

  it("starts with the same line the series is drawn with", () => {
    const plotted = plot([
      reading("2026-03-01", 0),
      reading("2026-03-16", 250_000),
      reading("2026-03-31", 500_000),
    ]);
    expect(burnAreaPath(plotted, 230).startsWith(burnLinePath(plotted))).toBe(
      true,
    );
  });

  it("keeps going below the baseline, for the half drawn as a problem", () => {
    // The engagement went $1,200 past a $5,000 price, so the last reading is
    // below the baseline and the closed shape spans both sides of it.
    const readings = [
      reading("2026-03-01", 0),
      reading("2026-03-31", 620_000),
    ];
    const domain = burnChartDomain(readings)!;
    const area = burnChartArea();
    const baseline = burnChartY(0, domain, area);
    const plotted = plotBurnReadings(readings, domain, area);
    expect(plotted[1].y).toBeGreaterThan(baseline);
    expect(burnAreaPath(plotted, baseline)).toContain(`L612 ${baseline}`);
  });

  it("has no area to fill for a single reading", () => {
    expect(burnAreaPath(plot([reading("2026-03-01", 100_000)]), 230)).toBe("");
  });

  it("has no area to fill for no readings at all", () => {
    expect(burnAreaPath([], 230)).toBe("");
  });

  it("closes the shape, so it fills rather than outlines", () => {
    const plotted = plot([
      reading("2026-03-01", 0),
      reading("2026-03-31", 250_000),
    ]);
    expect(burnAreaPath(plotted, 230).endsWith("Z")).toBe(true);
  });
});

describe("reconstructedBands", () => {
  const area = burnChartArea();

  /** A month of readings, each named by the day and how it was arrived at. */
  function line(days: readonly [string, string][]): BurnReading[] {
    return days.map(([onDate, origin], at) =>
      reading(onDate, at * 20_000, { origin }),
    );
  }

  it("shades the reconstructed opening of a line", () => {
    const readings = line([
      ["2026-03-01", "backfilled"],
      ["2026-03-16", "backfilled"],
      ["2026-03-31", "recorded"],
    ]);
    expect(
      reconstructedBands(readings, burnChartDomain(readings)!, area),
    ).toEqual([{ x: area.left, width: 272 }]);
  });

  it("shades nothing on a line that was measured throughout", () => {
    const readings = line([
      ["2026-03-01", "recorded"],
      ["2026-03-31", "recorded"],
    ]);
    expect(
      reconstructedBands(readings, burnChartDomain(readings)!, area),
    ).toEqual([]);
  });

  it("widens a single reconstructed day into something visible", () => {
    const readings = line([
      ["2026-03-01", "recorded"],
      ["2026-03-16", "backfilled"],
      ["2026-03-31", "recorded"],
    ]);
    const [band] = reconstructedBands(
      readings,
      burnChartDomain(readings)!,
      area,
    );
    expect(band.width).toBe(4);
    // Centred on the day itself, which is halfway across the plot.
    expect(band.x).toBe(338);
  });

  it("keeps a sliver at the start of the line inside the plot", () => {
    const readings = line([
      ["2026-03-01", "backfilled"],
      ["2026-03-16", "recorded"],
      ["2026-03-31", "recorded"],
    ]);
    const [band] = reconstructedBands(
      readings,
      burnChartDomain(readings)!,
      area,
    );
    expect(band.x).toBe(area.left);
    expect(band.x + band.width).toBeLessThanOrEqual(area.right);
  });

  it("keeps a sliver at the end of the line inside the plot", () => {
    const readings = line([
      ["2026-03-01", "recorded"],
      ["2026-03-16", "recorded"],
      ["2026-03-31", "backfilled"],
    ]);
    const [band] = reconstructedBands(
      readings,
      burnChartDomain(readings)!,
      area,
    );
    expect(band.x + band.width).toBe(area.right);
    expect(band.x).toBeGreaterThanOrEqual(area.left);
  });

  it("shades a repaired gap separately from the opening", () => {
    const readings = line([
      ["2026-03-01", "backfilled"],
      ["2026-03-09", "backfilled"],
      ["2026-03-16", "recorded"],
      ["2026-03-24", "backfilled"],
      ["2026-03-31", "recorded"],
    ]);
    const bands = reconstructedBands(
      readings,
      burnChartDomain(readings)!,
      area,
    );
    expect(bands).toHaveLength(2);
    expect(bands[0].x).toBe(area.left);
    expect(bands[1].x).toBeGreaterThan(bands[0].x + bands[0].width);
  });
});

describe("burnDownChart", () => {
  const area = burnChartArea();

  /** A month of an engagement that spent half its budget. */
  const halfSpent = [
    reading("2026-03-01", 0),
    reading("2026-03-16", 125_000),
    reading("2026-03-31", 250_000),
  ];

  it("has nothing to draw for a project with no readings", () => {
    expect(burnDownChart([])).toBeNull();
  });

  it("has nothing to draw when no money ever moved", () => {
    expect(
      burnDownChart([reading("2026-03-01", 0, { contractValueCents: 0 })]),
    ).toBeNull();
  });

  it("carries the line, the wash and the plot they are drawn in", () => {
    const chart = burnDownChart(halfSpent)!;
    expect(chart.linePath).toBe("M68 16 L340 69.5 L612 123");
    expect(chart.areaPath).toBe("M68 16 L340 69.5 L612 123 L612 230 L68 230 Z");
    expect(chart.area).toEqual(area);
  });

  it("ends the line on the last reading, for the dot and the label", () => {
    const chart = burnDownChart(halfSpent)!;
    expect(chart.last.reading.onDate).toBe("2026-03-31");
    expect(chart.last.x).toBe(area.right);
    expect(chart.last).toBe(chart.points[chart.points.length - 1]);
  });

  it("puts the baseline on the floor while the budget holds", () => {
    const chart = burnDownChart(halfSpent)!;
    expect(chart.baselineY).toBe(area.bottom);
    expect(chart.overrun).toBeNull();
    expect(chart.inHand).toEqual({
      x: area.left,
      y: area.top,
      width: area.width,
      height: area.height,
    });
  });

  it("lifts the baseline off the floor for an engagement that overran", () => {
    const chart = burnDownChart([
      reading("2026-03-01", 0),
      reading("2026-03-31", 620_000),
    ])!;
    expect(chart.baselineY).toBeLessThan(area.bottom);
    expect(chart.overrun).toMatchObject({ y: chart.baselineY });
    expect(chart.inHand?.height).toBeGreaterThan(0);
    expect(chart.overrun!.height).toBeGreaterThan(0);
  });

  it("meets the two halves of the wash exactly on the baseline", () => {
    const chart = burnDownChart([
      reading("2026-03-01", 0),
      reading("2026-03-31", 620_000),
    ])!;
    expect(chart.inHand!.y + chart.inHand!.height).toBe(chart.overrun!.y);
  });

  it("labels the money axis and places each gridline", () => {
    const chart = burnDownChart(halfSpent)!;
    expect(chart.moneyTicks.map((tick) => tick.label)).toEqual([
      "$0",
      "$1,000",
      "$2,000",
      "$3,000",
      "$4,000",
      "$5,000",
    ]);
    expect(chart.moneyTicks[0].y).toBe(area.bottom);
    expect(chart.moneyTicks[5].y).toBe(area.top);
  });

  it("labels the days and places each tick along the bottom", () => {
    const chart = burnDownChart(halfSpent)!;
    expect(chart.dateTicks.map((tick) => [tick.label, tick.x])).toEqual([
      ["Mar 1", area.left],
      ["Mar 16", 340],
      ["Mar 31", area.right],
    ]);
  });

  it("marks the stretch that was reconstructed", () => {
    const chart = burnDownChart([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-16", 125_000, { origin: "backfilled" }),
      reading("2026-03-31", 250_000),
    ])!;
    expect(chart.reconstructed).toEqual([{ x: area.left, width: 272 }]);
  });

  it("marks nothing on a line that was measured throughout", () => {
    expect(burnDownChart(halfSpent)!.reconstructed).toEqual([]);
  });

  it("draws a single reading as a point with no line or wash", () => {
    const chart = burnDownChart([reading("2026-03-01", 125_000)])!;
    expect(chart.points).toHaveLength(1);
    expect(chart.linePath).toBe("M340 69.5");
    expect(chart.areaPath).toBe("");
    expect(chart.dateTicks).toEqual([
      { onDate: "2026-03-01", label: "Mar 1", anchor: "middle", x: 340 },
    ]);
  });

  it("draws into whatever box it is given", () => {
    const chart = burnDownChart(halfSpent, {
      width: 400,
      height: 200,
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    })!;
    expect(chart.box.width).toBe(400);
    expect(chart.last.x).toBe(380);
    expect(chart.baselineY).toBe(170);
  });
});
