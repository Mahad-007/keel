import { describe, expect, it } from "vitest";

import { isWorked, timesheetCell, type TimesheetEntry } from "./timesheet";

/** A week's worth of fixtures: one project, named once. */
const PROJECT_ID = "prj_site";

function logged(
  workedOn: string,
  minutes: number,
  overrides: Partial<TimesheetEntry> = {},
): TimesheetEntry {
  return {
    projectId: PROJECT_ID,
    minutes,
    workedOn,
    billable: true,
    ...overrides,
  };
}

describe("timesheetCell", () => {
  it("adds the entries up", () => {
    const cell = timesheetCell("2026-10-27", [
      logged("2026-10-27", 90),
      logged("2026-10-27", 30),
    ]);
    expect(cell.minutes).toBe(120);
    expect(cell.entryCount).toBe(2);
  });

  it("keeps the day it was asked for", () => {
    expect(timesheetCell("2026-10-27", []).workedOn).toBe("2026-10-27");
  });

  it("comes to nothing on a day with no entries", () => {
    const cell = timesheetCell("2026-10-27", []);
    expect(cell.minutes).toBe(0);
    expect(cell.billableMinutes).toBe(0);
    expect(cell.entryCount).toBe(0);
  });

  it("leaves non-chargeable time out of the billable figure but in the total", () => {
    const cell = timesheetCell("2026-10-27", [
      logged("2026-10-27", 90),
      logged("2026-10-27", 60, { billable: false }),
    ]);
    expect(cell.minutes).toBe(150);
    expect(cell.billableMinutes).toBe(90);
  });

  it("counts a cell with nothing chargeable in it", () => {
    const cell = timesheetCell("2026-10-27", [
      logged("2026-10-27", 45, { billable: false }),
    ]);
    expect(cell.minutes).toBe(45);
    expect(cell.billableMinutes).toBe(0);
    expect(cell.entryCount).toBe(1);
  });
});

describe("isWorked", () => {
  it("is true for a cell with an entry in it", () => {
    expect(isWorked(timesheetCell("2026-10-27", [logged("2026-10-27", 15)]))).toBe(
      true,
    );
  });

  it("is false for a cell with nothing in it", () => {
    expect(isWorked(timesheetCell("2026-10-27", []))).toBe(false);
  });
});
