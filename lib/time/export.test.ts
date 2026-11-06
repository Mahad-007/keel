import { describe, expect, it } from "vitest";

import {
  exportFlag,
  exportHours,
  TIME_EXPORT_COLUMNS,
  timeEntryExportRow,
  type ExportableEntry,
} from "./export";

/** One logged stretch of work, with only what a test cares about spelled out. */
function entry(partial: Partial<ExportableEntry> = {}): ExportableEntry {
  return {
    workedOn: "2026-10-16",
    clientName: "Harbour Co",
    projectName: "Site rebuild",
    minutes: 90,
    billable: true,
    billedInvoiceId: null,
    note: "Two calls and the brief",
    ...partial,
  };
}

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

describe("timeEntryExportRow", () => {
  it("writes the columns the header names, in that order", () => {
    expect(timeEntryExportRow(entry())).toEqual([
      "2026-10-16",
      "Harbour Co",
      "Site rebuild",
      "90",
      "1.50",
      "Yes",
      "No",
      "Two calls and the brief",
    ]);
  });

  it("is as wide as the header row", () => {
    expect(timeEntryExportRow(entry())).toHaveLength(
      TIME_EXPORT_COLUMNS.length,
    );
  });

  it("hands the stored date over untouched", () => {
    expect(timeEntryExportRow(entry({ workedOn: "2026-01-04" }))[0]).toBe(
      "2026-01-04",
    );
  });

  it("says No in the chargeable column for time given away", () => {
    expect(timeEntryExportRow(entry({ billable: false }))[5]).toBe("No");
  });

  it("says Yes in the billed column once an invoice has it", () => {
    const row = timeEntryExportRow(entry({ billedInvoiceId: "inv_abc" }));

    expect(row[6]).toBe("Yes");
    expect(row).not.toContain("inv_abc");
  });

  it("leaves the note cell empty rather than writing the row's words", () => {
    expect(timeEntryExportRow(entry({ note: null })).at(-1)).toBe("");
  });

  it("hands a note's commas, quotes and breaks over unescaped", () => {
    const note = 'Design, build\nand "hand over"';

    expect(timeEntryExportRow(entry({ note })).at(-1)).toBe(note);
  });
});
