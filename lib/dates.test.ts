import { describe, expect, it } from "vitest";

import { formatDate } from "./dates";

describe("formatDate", () => {
  it("formats a full ISO timestamp", () => {
    expect(formatDate("2026-09-21T09:36:00.000Z")).toBe("Sep 21, 2026");
  });

  it("formats SQLite's current_timestamp form", () => {
    expect(formatDate("2026-09-21 09:36:00")).toBe("Sep 21, 2026");
  });

  it("formats a bare date", () => {
    expect(formatDate("2026-01-05")).toBe("Jan 5, 2026");
  });

  it("reads the calendar date off the string rather than a local Date", () => {
    // Late-evening UTC: constructing a Date would roll this back a day for
    // anyone west of Greenwich.
    expect(formatDate("2026-03-01T23:59:59.000Z")).toBe("Mar 1, 2026");
  });

  it("ignores surrounding whitespace", () => {
    expect(formatDate("  2026-12-31T00:00:00.000Z  ")).toBe("Dec 31, 2026");
  });

  it("hands back a value with an impossible month unchanged", () => {
    expect(formatDate("2026-13-01")).toBe("2026-13-01");
  });

  it("hands back anything that isn't a date unchanged", () => {
    expect(formatDate("not a date")).toBe("not a date");
    expect(formatDate("")).toBe("");
    expect(formatDate("21/09/2026")).toBe("21/09/2026");
    expect(formatDate("2026-09-2")).toBe("2026-09-2");
  });
});
