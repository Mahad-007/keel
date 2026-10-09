import { describe, expect, it } from "vitest";

import { capturedTemplateLines } from "./capture";

describe("capturedTemplateLines", () => {
  it("carries the title, the detail, and the estimate across", () => {
    const lines = capturedTemplateLines([
      {
        title: "Design system",
        description: "Tokens, type scale, component inventory.",
        estimatedMinutes: 1_200,
      },
    ]);

    expect(lines).toEqual([
      {
        title: "Design system",
        description: "Tokens, type scale, component inventory.",
        estimatedMinutes: 1_200,
      },
    ]);
  });

  it("keeps the order the scope list was agreed in", () => {
    const lines = capturedTemplateLines([
      { title: "Discovery", description: null, estimatedMinutes: 480 },
      { title: "Build", description: null, estimatedMinutes: 2_400 },
      { title: "Handover", description: null, estimatedMinutes: 120 },
    ]);

    expect(lines.map((line) => line.title)).toEqual([
      "Discovery",
      "Build",
      "Handover",
    ]);
  });

  it("keeps an unestimated line rather than dropping it", () => {
    const lines = capturedTemplateLines([
      { title: "Discovery", description: null, estimatedMinutes: 480 },
      { title: "Whatever else comes up", description: null, estimatedMinutes: 0 },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[1].estimatedMinutes).toBe(0);
  });

  it("captures an empty scope list as an empty set of lines", () => {
    expect(capturedTemplateLines([])).toEqual([]);
  });

  it("does not carry a status across, whatever the source line holds", () => {
    const [line] = capturedTemplateLines([
      {
        title: "Build",
        description: null,
        estimatedMinutes: 2_400,
        // A whole row goes in at the call site; the draft takes three fields.
        ...{ status: "done", id: "dlv_1", sortOrder: 4 },
      },
    ]);

    expect(line).not.toHaveProperty("status");
    expect(line).not.toHaveProperty("sortOrder");
    expect(line).not.toHaveProperty("id");
  });
});
