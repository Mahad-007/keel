import { describe, expect, it } from "vitest";

import { submitLabel } from "./submit-label";

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
