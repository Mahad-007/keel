import { describe, expect, it } from "vitest";

import { exportFlag, exportHours, TIME_EXPORT_COLUMNS } from "./export";

describe("TIME_EXPORT_COLUMNS", () => {
  it("leads with the date and ends with the note", () => {
    expect(TIME_EXPORT_COLUMNS[0]).toBe("Date");
    expect(TIME_EXPORT_COLUMNS.at(-1)).toBe("Note");
  });

  it("names each column once", () => {
    expect(new Set(TIME_EXPORT_COLUMNS).size).toBe(
      TIME_EXPORT_COLUMNS.length,
    );
  });
});

describe("exportHours", () => {
  it("writes a whole hour to two places", () => {
    expect(exportHours(60)).toBe("1.00");
  });

  it("writes a half hour as a half", () => {
    expect(exportHours(90)).toBe("1.50");
  });

  it("rounds a third of an hour to the places it has", () => {
    expect(exportHours(20)).toBe("0.33");
  });

  it("writes no time at all as zero", () => {
    expect(exportHours(0)).toBe("0.00");
  });

  it("keeps a long week in hours a reader recognises", () => {
    expect(exportHours(2415)).toBe("40.25");
  });

  it("never comes back as something a sheet reads as a formula", () => {
    expect(exportHours(1).startsWith("0")).toBe(true);
  });
});

describe("exportFlag", () => {
  it("says Yes and No rather than true and false", () => {
    expect(exportFlag(true)).toBe("Yes");
    expect(exportFlag(false)).toBe("No");
  });
});
