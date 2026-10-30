import { describe, expect, it } from "vitest";

import {
  belongsOnSheet,
  buildTimesheet,
  cellFigure,
  compareRows,
  daysWorked,
  describeCell,
  describeTimesheet,
  isSheetEmpty,
  NOTHING_LOGGED,
  sheetSize,
  expectsTime,
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

describe("expectsTime", () => {
  it("expects work on an active project", () => {
    expect(expectsTime({ status: "active" })).toBe(true);
  });

  it("expects none on a draft, a paused or a closed one", () => {
    expect(expectsTime({ status: "draft" })).toBe(false);
    expect(expectsTime({ status: "paused" })).toBe(false);
    expect(expectsTime({ status: "closed" })).toBe(false);
  });
});

describe("belongsOnSheet", () => {
  const week = weekOf("2026-10-29");

  function rowFor(status: TimesheetProject["status"], entries: TimesheetEntry[]) {
    return timesheetRow({ ...SITE_REBUILD, status }, week, entries);
  }

  it("keeps an active project with nothing logged", () => {
    expect(belongsOnSheet(rowFor("active", []))).toBe(true);
  });

  it("drops a closed project with nothing logged", () => {
    expect(belongsOnSheet(rowFor("closed", []))).toBe(false);
  });

  it("drops a draft and a paused project with nothing logged", () => {
    expect(belongsOnSheet(rowFor("draft", []))).toBe(false);
    expect(belongsOnSheet(rowFor("paused", []))).toBe(false);
  });

  it("keeps a closed project that was worked this week", () => {
    expect(belongsOnSheet(rowFor("closed", [logged("2026-10-27", 30)]))).toBe(
      true,
    );
  });

  it("keeps a paused project that was worked this week", () => {
    expect(belongsOnSheet(rowFor("paused", [logged("2026-10-27", 30)]))).toBe(
      true,
    );
  });

  it("drops a closed project whose only work was in another week", () => {
    expect(belongsOnSheet(rowFor("closed", [logged("2026-10-19", 30)]))).toBe(
      false,
    );
  });
});

describe("compareRows", () => {
  const week = weekOf("2026-10-29");

  function rowFor(project: Partial<TimesheetProject>) {
    return timesheetRow({ ...SITE_REBUILD, ...project }, week, []);
  }

  function order(projects: Partial<TimesheetProject>[]) {
    return projects
      .map(rowFor)
      .sort(compareRows)
      .map((row) => `${row.project.clientName}/${row.project.name}`);
  }

  it("groups a client's projects together", () => {
    expect(
      order([
        { id: "a", clientName: "Harbour Co", name: "Site" },
        { id: "b", clientName: "Anvil", name: "Brand" },
        { id: "c", clientName: "Harbour Co", name: "App" },
      ]),
    ).toEqual(["Anvil/Brand", "Harbour Co/App", "Harbour Co/Site"]);
  });

  it("ignores case, so a lowercase client is not banished to the bottom", () => {
    expect(
      order([
        { id: "a", clientName: "Zephyr", name: "One" },
        { id: "b", clientName: "acme", name: "One" },
      ]),
    ).toEqual(["acme/One", "Zephyr/One"]);
  });

  it("does not order by how much was logged", () => {
    const busy = timesheetRow(
      { ...SITE_REBUILD, id: "z", clientName: "Zephyr", name: "Busy" },
      week,
      [logged("2026-10-27", 600)],
    );
    const idle = timesheetRow(
      { ...SITE_REBUILD, id: "a", clientName: "Anvil", name: "Idle" },
      week,
      [],
    );
    expect([busy, idle].sort(compareRows)[0]).toBe(idle);
  });

  it("falls back to the id so identically named rows keep a fixed order", () => {
    const first = rowFor({ id: "prj_a", clientName: "Anvil", name: "Site" });
    const second = rowFor({ id: "prj_b", clientName: "Anvil", name: "Site" });
    expect([second, first].sort(compareRows)).toEqual([first, second]);
  });

  it("is a stable comparison in both directions", () => {
    const left = rowFor({ id: "a", clientName: "Anvil", name: "Site" });
    const right = rowFor({ id: "b", clientName: "Harbour Co", name: "App" });
    expect(compareRows(left, right)).toBeLessThan(0);
    expect(compareRows(right, left)).toBeGreaterThan(0);
    expect(compareRows(left, left)).toBe(0);
  });
});

describe("buildTimesheet", () => {
  const week = weekOf("2026-10-29");

  const anvilBrand: TimesheetProject = {
    id: "prj_brand",
    name: "Brand refresh",
    clientName: "Anvil",
    status: "active",
  };

  it("gives every included project a row, in order", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvilBrand], []);
    expect(sheet.rows.map((row) => row.project.id)).toEqual([
      anvilBrand.id,
      SITE_REBUILD.id,
    ]);
  });

  it("files each entry under its own project", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvilBrand], [
      logged("2026-10-27", 60),
      logged("2026-10-27", 30, { projectId: anvilBrand.id }),
    ]);
    const brand = sheet.rows.find((row) => row.project.id === anvilBrand.id);
    const site = sheet.rows.find((row) => row.project.id === SITE_REBUILD.id);
    expect(brand?.minutes).toBe(30);
    expect(site?.minutes).toBe(60);
  });

  it("totals each day down the column", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvilBrand], [
      logged("2026-10-27", 60),
      logged("2026-10-27", 30, { projectId: anvilBrand.id }),
      logged("2026-10-29", 45),
    ]);
    expect(sheet.dayTotals.map((cell) => cell.minutes)).toEqual([
      0, 90, 0, 45, 0, 0, 0,
    ]);
  });

  it("heads the day totals with the week's own days", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD], []);
    expect(sheet.dayTotals.map((cell) => cell.workedOn)).toEqual(week.days);
  });

  it("agrees between the corner, the rows and the columns", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvilBrand], [
      logged("2026-10-26", 15),
      logged("2026-10-28", 120, { projectId: anvilBrand.id }),
      logged("2026-11-01", 45, { billable: false }),
    ]);
    const acrossRows = sheet.rows.reduce((sum, row) => sum + row.minutes, 0);
    const downColumns = sheet.dayTotals.reduce(
      (sum, cell) => sum + cell.minutes,
      0,
    );
    expect(sheet.minutes).toBe(180);
    expect(acrossRows).toBe(180);
    expect(downColumns).toBe(180);
    expect(sheet.billableMinutes).toBe(135);
    expect(sheet.entryCount).toBe(3);
  });

  it("keeps the week it was built for", () => {
    expect(buildTimesheet(week, [], []).week).toBe(week);
  });

  it("leaves out a project the week expects nothing from", () => {
    const sheet = buildTimesheet(
      week,
      [SITE_REBUILD, { ...anvilBrand, status: "closed" }],
      [],
    );
    expect(sheet.rows.map((row) => row.project.id)).toEqual([SITE_REBUILD.id]);
  });

  it("drops entries naming a project it has no row for", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD], [
      logged("2026-10-27", 60),
      logged("2026-10-27", 999, { projectId: "prj_elsewhere" }),
    ]);
    expect(sheet.minutes).toBe(60);
    expect(sheet.rows).toHaveLength(1);
  });

  it("holds no rows and no minutes for a studio with no projects", () => {
    const sheet = buildTimesheet(week, [], []);
    expect(sheet.rows).toEqual([]);
    expect(sheet.minutes).toBe(0);
    expect(sheet.dayTotals.every((cell) => cell.minutes === 0)).toBe(true);
  });

  it("sorts rows however the projects arrived", () => {
    const forwards = buildTimesheet(week, [anvilBrand, SITE_REBUILD], []);
    const backwards = buildTimesheet(week, [SITE_REBUILD, anvilBrand], []);
    expect(forwards.rows.map((row) => row.project.id)).toEqual(
      backwards.rows.map((row) => row.project.id),
    );
  });
});

describe("cellFigure", () => {
  it("writes the duration of a worked cell", () => {
    expect(cellFigure(timesheetCell("2026-10-27", [logged("2026-10-27", 150)]))).toBe(
      "2h 30m",
    );
  });

  it("writes a dash rather than a zero for an empty cell", () => {
    expect(cellFigure(timesheetCell("2026-10-27", []))).toBe(NOTHING_LOGGED);
  });

  it("writes the total of a cell built from several entries", () => {
    expect(
      cellFigure(
        timesheetCell("2026-10-27", [
          logged("2026-10-27", 90),
          logged("2026-10-27", 45),
        ]),
      ),
    ).toBe("2h 15m");
  });
});

describe("describeCell", () => {
  it("says where the cell is before saying what is in it", () => {
    const cell = timesheetCell("2026-10-27", [logged("2026-10-27", 150)]);
    expect(describeCell(SITE_REBUILD, cell)).toBe(
      "Site rebuild, Harbour Co, Tue 27 — 2h 30m, one entry",
    );
  });

  it("counts several entries", () => {
    const cell = timesheetCell("2026-10-27", [
      logged("2026-10-27", 90),
      logged("2026-10-27", 60),
    ]);
    expect(describeCell(SITE_REBUILD, cell)).toBe(
      "Site rebuild, Harbour Co, Tue 27 — 2h 30m, 2 entries",
    );
  });

  it("says nothing is logged rather than reading out a zero", () => {
    expect(describeCell(SITE_REBUILD, timesheetCell("2026-10-27", []))).toBe(
      "Site rebuild, Harbour Co, Tue 27 — nothing logged",
    );
  });

  it("mentions the part that will not be charged for", () => {
    const cell = timesheetCell("2026-10-27", [
      logged("2026-10-27", 120),
      logged("2026-10-27", 30, { billable: false }),
    ]);
    expect(describeCell(SITE_REBUILD, cell)).toBe(
      "Site rebuild, Harbour Co, Tue 27 — 2h 30m, 2 entries, 30m not chargeable",
    );
  });

  it("stays silent about charging when all of it will be charged for", () => {
    const cell = timesheetCell("2026-10-27", [logged("2026-10-27", 60)]);
    expect(describeCell(SITE_REBUILD, cell)).not.toContain("chargeable");
  });
});

describe("describeTimesheet", () => {
  const week = weekOf("2026-10-29");
  const anvil: TimesheetProject = {
    id: "prj_brand",
    name: "Brand refresh",
    clientName: "Anvil",
    status: "active",
  };

  it("counts the projects, the hours and the days", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvil], [
      logged("2026-10-27", 120),
      logged("2026-10-29", 90, { projectId: anvil.id }),
    ]);
    expect(describeTimesheet(sheet)).toBe("2 projects, 3h 30m logged over 2 days.");
  });

  it("says one day rather than over one day", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD], [
      logged("2026-10-27", 60),
    ]);
    expect(describeTimesheet(sheet)).toBe("One project, 1h logged on one day.");
  });

  it("says a week with nothing in it is empty rather than reading out a zero", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvil], []);
    expect(describeTimesheet(sheet)).toBe("2 projects, nothing logged this week.");
  });

  it("says so when there is no row to show", () => {
    expect(describeTimesheet(buildTimesheet(week, [], []))).toBe(
      "No projects to show for this week.",
    );
  });

  it("counts a day once however many projects worked it", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD, anvil], [
      logged("2026-10-27", 60),
      logged("2026-10-27", 60, { projectId: anvil.id }),
    ]);
    expect(describeTimesheet(sheet)).toBe("2 projects, 2h logged on one day.");
  });
});

describe("daysWorked", () => {
  const week = weekOf("2026-10-29");

  it("counts only the days with work in them", () => {
    const sheet = buildTimesheet(week, [SITE_REBUILD], [
      logged("2026-10-26", 30),
      logged("2026-10-30", 30),
      logged("2026-11-01", 30),
    ]);
    expect(daysWorked(sheet)).toBe(3);
  });

  it("counts nothing for an empty week", () => {
    expect(daysWorked(buildTimesheet(week, [SITE_REBUILD], []))).toBe(0);
  });

  it("cannot count more than the week holds", () => {
    const sheet = buildTimesheet(
      week,
      [SITE_REBUILD],
      week.days.map((day) => logged(day, 15)),
    );
    expect(daysWorked(sheet)).toBe(DAYS_PER_WEEK);
  });
});

describe("sheetSize", () => {
  const week = weekOf("2026-10-29");
  const anvil: TimesheetProject = {
    id: "prj_brand",
    name: "Brand refresh",
    clientName: "Anvil",
    status: "active",
  };

  it("is as many rows as the sheet has, and a week wide", () => {
    expect(sheetSize(buildTimesheet(week, [SITE_REBUILD, anvil], []))).toEqual({
      rows: 2,
      columns: DAYS_PER_WEEK,
    });
  });

  it("is still a week wide on a week with nothing logged", () => {
    expect(sheetSize(buildTimesheet(week, [SITE_REBUILD], [])).columns).toBe(
      DAYS_PER_WEEK,
    );
  });

  it("counts the rows that were kept, not the projects offered", () => {
    const sheet = buildTimesheet(
      week,
      [SITE_REBUILD, { ...anvil, status: "closed" }],
      [],
    );
    expect(sheetSize(sheet).rows).toBe(1);
  });
});

describe("isSheetEmpty", () => {
  const week = weekOf("2026-10-29");

  it("is true when there is no row to draw", () => {
    expect(isSheetEmpty(buildTimesheet(week, [], []))).toBe(true);
  });

  it("is false for a week with rows but nothing logged", () => {
    expect(isSheetEmpty(buildTimesheet(week, [SITE_REBUILD], []))).toBe(false);
  });
});
