import { describe, expect, it } from "vitest";

import { submitAriaLabel, submitLabel } from "./submit-label";

describe("submitLabel", () => {
  it("shows the idle wording before the form is submitted", () => {
    expect(submitLabel("Save client", "Saving…", false)).toBe("Save client");
  });

  it("swaps to the pending wording while the form is in flight", () => {
    expect(submitLabel("Save client", "Saving…", true)).toBe("Saving…");
  });

  it("never shows both at once", () => {
    const pending = submitLabel("Archive client", "Archiving…", true);

    expect(pending).not.toContain("Archive client");
  });
});

describe("submitAriaLabel", () => {
  it("leaves a lone button named by its own text", () => {
    expect(submitAriaLabel("Save client", undefined)).toBeUndefined();
  });

  it("names the subject a repeated button acts on", () => {
    expect(submitAriaLabel("Restore", "Ada Lovelace")).toBe(
      "Restore Ada Lovelace",
    );
  });

  it("follows the label, so a pending button still names its subject", () => {
    expect(submitAriaLabel("Restoring…", "Ada Lovelace")).toBe(
      "Restoring… Ada Lovelace",
    );
  });

  it("ignores a subject that is blank or only whitespace", () => {
    expect(submitAriaLabel("Restore", "")).toBeUndefined();
    expect(submitAriaLabel("Restore", "   ")).toBeUndefined();
  });

  it("does not double the space before a padded subject", () => {
    expect(submitAriaLabel("Restore", "  Ada  ")).toBe("Restore Ada");
  });
});
