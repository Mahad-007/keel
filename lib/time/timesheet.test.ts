import { describe, expect, it } from "vitest";

import {
  isWorked,
  sumCells,
  timesheetCell,
  timesheetRow,
  weekCells,
  type TimesheetEntry,
  type TimesheetProject,
} from "./timesheet";
import { DAYS_PER_WEEK, weekOf } from "./week";

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

const SITE_REBUILD: TimesheetProject = {
  id: PROJECT_ID,
  name: "Site rebuild",
  clientName: "Harbour Co",
  status: "active",
};

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

describe("weekCells", () => {
  const week = weekOf("2026-10-29");

  it("holds one cell per day, in the week's order", () => {
    const cells = weekCells(week, []);
    expect(cells).toHaveLength(DAYS_PER_WEEK);
    expect(cells.map((cell) => cell.workedOn)).toEqual(week.days);
  });

  it("files an entry under the day it was worked", () => {
    const cells = weekCells(week, [logged("2026-10-28", 120)]);
    expect(cells.map((cell) => cell.minutes)).toEqual([0, 0, 120, 0, 0, 0, 0]);
  });

  it("gathers several entries on one day into one cell", () => {
    const cells = weekCells(week, [
      logged("2026-10-28", 90),
      logged("2026-10-28", 30),
    ]);
    expect(cells[2].minutes).toBe(120);
    expect(cells[2].entryCount).toBe(2);
  });

  it("gathers entries on a day even when they are not next to each other", () => {
    const cells = weekCells(week, [
      logged("2026-10-28", 90),
      logged("2026-10-30", 60),
      logged("2026-10-28", 30),
    ]);
    expect(cells[2].entryCount).toBe(2);
    expect(cells[2].minutes).toBe(120);
  });

  it("fills the weekend columns like any other day", () => {
    const cells = weekCells(week, [logged("2026-11-01", 45)]);
    expect(cells[6].minutes).toBe(45);
  });

  it("drops entries from outside the week", () => {
    const cells = weekCells(week, [
      logged("2026-10-25", 600),
      logged("2026-10-28", 60),
      logged("2026-11-02", 600),
    ]);
    expect(cells.reduce((sum, cell) => sum + cell.minutes, 0)).toBe(60);
  });

  it("keeps the cells' total equal to the entries it kept", () => {
    const cells = weekCells(week, [
      logged("2026-10-26", 30),
      logged("2026-10-29", 45),
      logged("2026-11-01", 15),
    ]);
    expect(cells.reduce((sum, cell) => sum + cell.minutes, 0)).toBe(90);
  });
});

describe("sumCells", () => {
  const week = weekOf("2026-10-29");

  it("adds every figure a cell holds", () => {
    const cells = weekCells(week, [
      logged("2026-10-26", 60),
      logged("2026-10-28", 90, { billable: false }),
      logged("2026-10-28", 30),
    ]);
    expect(sumCells(cells)).toEqual({
      minutes: 180,
      billableMinutes: 90,
      entryCount: 3,
    });
  });

  it("comes to nothing for no cells at all", () => {
    expect(sumCells([])).toEqual({
      minutes: 0,
      billableMinutes: 0,
      entryCount: 0,
    });
  });

  it("comes to nothing for a week of empty cells", () => {
    expect(sumCells(weekCells(week, []))).toEqual({
      minutes: 0,
      billableMinutes: 0,
      entryCount: 0,
    });
  });
});

describe("timesheetRow", () => {
  const week = weekOf("2026-10-29");

  it("names the project it is a row for", () => {
    expect(timesheetRow(SITE_REBUILD, week, []).project).toBe(SITE_REBUILD);
  });

  it("totals the week across the row", () => {
    const row = timesheetRow(SITE_REBUILD, week, [
      logged("2026-10-26", 120),
      logged("2026-10-29", 45),
    ]);
    expect(row.minutes).toBe(165);
    expect(row.entryCount).toBe(2);
  });

  it("keeps the row total equal to the sum of its printed cells", () => {
    const row = timesheetRow(SITE_REBUILD, week, [
      logged("2026-10-20", 600),
      logged("2026-10-27", 30),
    ]);
    expect(row.minutes).toBe(sumCells(row.cells).minutes);
    expect(row.minutes).toBe(30);
  });

  it("totals the chargeable part separately", () => {
    const row = timesheetRow(SITE_REBUILD, week, [
      logged("2026-10-27", 60),
      logged("2026-10-27", 60, { billable: false }),
    ]);
    expect(row.minutes).toBe(120);
    expect(row.billableMinutes).toBe(60);
  });

  it("is still seven cells wide with nothing logged", () => {
    expect(timesheetRow(SITE_REBUILD, week, []).cells).toHaveLength(
      DAYS_PER_WEEK,
    );
  });
});
