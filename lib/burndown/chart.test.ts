import { describe, expect, it } from "vitest";

import { BURN_CHART_BOX, burnChartArea } from "./chart";

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
