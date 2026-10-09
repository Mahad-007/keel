import { describe, expect, it } from "vitest";

import { appliedTemplateLines } from "./apply";

const LINES = [
  { title: "Discovery", description: "Two workshops.", estimatedMinutes: 480 },
  { title: "Build", description: null, estimatedMinutes: 2_400 },
  { title: "Handover", description: null, estimatedMinutes: 0 },
];

describe("appliedTemplateLines", () => {
  it("starts an empty project's scope list at zero", () => {
    const applied = appliedTemplateLines(LINES, null);

    expect(applied.map((line) => line.sortOrder)).toEqual([0, 1, 2]);
  });

  it("appends after the position the existing list stops at", () => {
    const applied = appliedTemplateLines(LINES, 3);

    expect(applied.map((line) => line.sortOrder)).toEqual([4, 5, 6]);
  });

  it("keeps the order the template holds its lines in", () => {
    const applied = appliedTemplateLines(LINES, null);

    expect(applied.map((line) => line.title)).toEqual([
      "Discovery",
      "Build",
      "Handover",
    ]);
  });

  it("carries the detail and the estimate onto the applied line", () => {
    const [first] = appliedTemplateLines(LINES, null);

    expect(first.description).toBe("Two workshops.");
    expect(first.estimatedMinutes).toBe(480);
  });

  it("leaves an unestimated line unestimated rather than guessing", () => {
    const applied = appliedTemplateLines(LINES, null);

    expect(applied[2].estimatedMinutes).toBe(0);
  });

  it("does not decide the status of what it applies", () => {
    const [first] = appliedTemplateLines(LINES, null);

    expect(first).not.toHaveProperty("status");
  });

  it("applies an empty template as no lines at all", () => {
    expect(appliedTemplateLines([], 7)).toEqual([]);
  });
});
