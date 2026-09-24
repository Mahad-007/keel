import { describe, expect, it } from "vitest";

import { requiredText } from "./fields";

describe("requiredText", () => {
  it("returns the value with surrounding whitespace removed", () => {
    expect(requiredText("  Redesign  ", "project name")).toBe("Redesign");
  });

  it("keeps whitespace inside the value", () => {
    expect(requiredText(" Site  Redesign ", "project name")).toBe(
      "Site  Redesign",
    );
  });

  it("refuses a blank value", () => {
    expect(() => requiredText("", "project name")).toThrow(
      "project name is required",
    );
  });

  it("refuses a value that is only whitespace", () => {
    expect(() => requiredText("  \t\n ", "project name")).toThrow(
      "project name is required",
    );
  });

  it("names the field so the error says which column complained", () => {
    expect(() => requiredText("", "client name")).toThrow(/client name/);
  });
});
