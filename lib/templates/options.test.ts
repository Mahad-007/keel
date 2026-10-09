import { describe, expect, it } from "vitest";

import { templateOptionLabel, templateOptions } from "./options";

const WEBSITE = {
  id: "tpl_web",
  name: "Website build",
  description: "The usual five phases.",
  lineCount: 5,
  estimatedMinutes: 4_800,
  unestimatedCount: 0,
};

const RETAINER = {
  id: "tpl_ret",
  name: "Retainer month",
  description: null,
  lineCount: 2,
  estimatedMinutes: 0,
  unestimatedCount: 2,
};

describe("templateOptionLabel", () => {
  it("puts the name first and the size after it", () => {
    expect(templateOptionLabel(WEBSITE)).toBe(
      "Website build · 5 deliverables · 80h",
    );
  });

  it("says a template is unestimated rather than printing a zero total", () => {
    expect(templateOptionLabel(RETAINER)).toBe(
      "Retainer month · 2 deliverables · not estimated",
    );
  });

  it("leaves the description out of the line", () => {
    expect(templateOptionLabel(WEBSITE)).not.toContain("five phases");
  });
});

describe("templateOptions", () => {
  it("offers one option per template, in the order given", () => {
    expect(templateOptions([WEBSITE, RETAINER]).map((o) => o.id)).toEqual([
      "tpl_web",
      "tpl_ret",
    ]);
  });

  it("offers nothing when there are no templates", () => {
    expect(templateOptions([])).toEqual([]);
  });
});
