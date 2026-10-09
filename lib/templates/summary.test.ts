import { describe, expect, it } from "vitest";

import { templateSize, templateSizeLabel } from "./summary";

describe("templateSize", () => {
  it("counts the lines and totals the minutes", () => {
    const size = templateSize([
      { estimatedMinutes: 480 },
      { estimatedMinutes: 120 },
    ]);

    expect(size.lineCount).toBe(2);
    expect(size.estimatedMinutes).toBe(600);
  });

  it("counts the lines nobody has estimated", () => {
    const size = templateSize([
      { estimatedMinutes: 480 },
      { estimatedMinutes: 0 },
      { estimatedMinutes: 0 },
    ]);

    expect(size.unestimatedCount).toBe(2);
    expect(size.estimatedMinutes).toBe(480);
  });

  it("reports an empty template as nothing in every figure", () => {
    expect(templateSize([])).toEqual({
      lineCount: 0,
      estimatedMinutes: 0,
      unestimatedCount: 0,
    });
  });
});

describe("templateSizeLabel", () => {
  it("says the count and the total when every line is estimated", () => {
    expect(
      templateSizeLabel({
        lineCount: 3,
        estimatedMinutes: 600,
        unestimatedCount: 0,
      }),
    ).toBe("3 deliverables · 10h");
  });

  it("agrees the noun with a count of one", () => {
    expect(
      templateSizeLabel({
        lineCount: 1,
        estimatedMinutes: 90,
        unestimatedCount: 0,
      }),
    ).toBe("1 deliverable · 1h 30m");
  });

  it("names how many lines the total does not speak for", () => {
    expect(
      templateSizeLabel({
        lineCount: 4,
        estimatedMinutes: 600,
        unestimatedCount: 1,
      }),
    ).toBe("4 deliverables · 10h, 1 not estimated");
  });

  it("refuses to print a total for a template with nothing sized", () => {
    expect(
      templateSizeLabel({
        lineCount: 2,
        estimatedMinutes: 0,
        unestimatedCount: 2,
      }),
    ).toBe("2 deliverables · not estimated");
  });

  it("calls a template with no lines on it empty", () => {
    expect(
      templateSizeLabel({
        lineCount: 0,
        estimatedMinutes: 0,
        unestimatedCount: 0,
      }),
    ).toBe("empty");
  });
});
