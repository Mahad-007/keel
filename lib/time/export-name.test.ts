import { describe, expect, it } from "vitest";

import { ALL_TIME_PART, rangeNamePart } from "./export-name";
import { ALL_DATES } from "./range";

describe("rangeNamePart", () => {
  it("names a closed range by both its days", () => {
    expect(rangeNamePart({ from: "2026-10-01", to: "2026-10-31" })).toBe(
      "2026-10-01-to-2026-10-31",
    );
  });

  it("names one day once", () => {
    expect(rangeNamePart({ from: "2026-10-16", to: "2026-10-16" })).toBe(
      "2026-10-16",
    );
  });

  it("says which end is open", () => {
    expect(rangeNamePart({ from: "2026-10-01", to: null })).toBe(
      "from-2026-10-01",
    );
    expect(rangeNamePart({ from: null, to: "2026-10-31" })).toBe(
      "to-2026-10-31",
    );
  });

  it("names a range with both ends open", () => {
    expect(rangeNamePart(ALL_DATES)).toBe(ALL_TIME_PART);
  });

  it("names a backwards range as it was typed", () => {
    expect(rangeNamePart({ from: "2026-10-31", to: "2026-10-01" })).toBe(
      "2026-10-31-to-2026-10-01",
    );
  });

  it("comes back as something a filename can hold", () => {
    expect(rangeNamePart({ from: "2026-10-01", to: "2026-10-31" })).toMatch(
      /^[a-z0-9-]+$/,
    );
    expect(rangeNamePart(ALL_DATES)).toMatch(/^[a-z0-9-]+$/);
  });
});
