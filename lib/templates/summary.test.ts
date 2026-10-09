import { describe, expect, it } from "vitest";

import { templateSize } from "./summary";

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
