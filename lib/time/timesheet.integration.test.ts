import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createProject,
  listProjectsWithClient,
  transitionProject,
} from "@/lib/data/projects";
import {
  createTimeEntry,
  listTimeEntriesInRange,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { buildTimesheet, cellFigure } from "./timesheet";
import { weekOf } from "./week";

/**
 * The seam the timesheet is made of: a project list from one table and a
 * week's entries from another, laid out against seven dates that neither of
 * them stores.
 *
 * `timesheet.ts` is pure and its own tests say what the arithmetic does. What
 * they cannot say is that `TimesheetProject` still describes a real row out of
 * `listProjectsWithClient`, that `TimesheetEntry` still describes a real time
 * row, or that the range the page asks the database for is the same seven days
 * the grid draws. All three are structural — the sort of thing that compiles
 * for a year and then stops when a column is renamed or a boundary moves by a
 * day.
 *
 * So the sheet is built here the way the page builds it, over rows this test
 * actually wrote, through the same two data-layer functions.
 */

const WEEK = weekOf("2026-10-29");

let db: Database;
let siteId: string;
let brandId: string;

beforeEach(async () => {
  db = await createTestDb();

  const harbour = await createClient({ name: "Harbour Co" }, db);
  const anvil = await createClient({ name: "Anvil" }, db);

  const site = await createProject(
    { clientId: harbour.id, name: "Site rebuild", status: "active" },
    db,
  );
  const brand = await createProject(
    { clientId: anvil.id, name: "Brand refresh", status: "active" },
    db,
  );
  siteId = site.id;
  brandId = brand.id;
});

/** The sheet the page would render for `WEEK`, through the page's two queries. */
async function sheetForWeek() {
  const [projects, entries] = await Promise.all([
    listProjectsWithClient({}, db),
    listTimeEntriesInRange({ from: WEEK.start, to: WEEK.end }, db),
  ]);
  return buildTimesheet(WEEK, projects, entries);
}

describe("a week built from rows the data layer wrote", () => {
  it("lands each entry in the cell its project and day name", async () => {
    await createTimeEntry(
      { projectId: siteId, minutes: 150, workedOn: "2026-10-27" },
      db,
    );
    await createTimeEntry(
      { projectId: brandId, minutes: 60, workedOn: "2026-10-29" },
      db,
    );

    const sheet = await sheetForWeek();
    const site = sheet.rows.find((row) => row.project.id === siteId);
    const brand = sheet.rows.find((row) => row.project.id === brandId);

    expect(site?.cells.map(cellFigure)).toEqual([
      "–",
      "2h 30m",
      "–",
      "–",
      "–",
      "–",
      "–",
    ]);
    expect(brand?.cells[3].minutes).toBe(60);
  });

  it("names the client the project was filed under", async () => {
    const sheet = await sheetForWeek();
    expect(
      sheet.rows.map((row) => `${row.project.clientName}: ${row.project.name}`),
    ).toEqual(["Anvil: Brand refresh", "Harbour Co: Site rebuild"]);
  });

  it("includes work on the first and last day of the week", async () => {
    await createTimeEntry(
      { projectId: siteId, minutes: 30, workedOn: WEEK.start },
      db,
    );
    await createTimeEntry(
      { projectId: siteId, minutes: 45, workedOn: WEEK.end },
      db,
    );

    const sheet = await sheetForWeek();
    expect(sheet.minutes).toBe(75);
    expect(sheet.dayTotals[0].minutes).toBe(30);
    expect(sheet.dayTotals[6].minutes).toBe(45);
  });

  it("leaves out work from the day either side of the week", async () => {
    await createTimeEntry(
      { projectId: siteId, minutes: 600, workedOn: "2026-10-25" },
      db,
    );
    await createTimeEntry(
      { projectId: siteId, minutes: 600, workedOn: "2026-11-02" },
      db,
    );

    const sheet = await sheetForWeek();
    expect(sheet.minutes).toBe(0);
  });

  it("keeps a closed project on the week it was worked", async () => {
    await createTimeEntry(
      { projectId: brandId, minutes: 90, workedOn: "2026-10-28" },
      db,
    );
    await transitionProject(brandId, "paused", {}, db);
    await transitionProject(brandId, "closed", {}, db);

    const sheet = await sheetForWeek();
    const brand = sheet.rows.find((row) => row.project.id === brandId);
    expect(brand?.project.status).toBe("closed");
    expect(brand?.minutes).toBe(90);
  });

  it("drops a closed project from a week it was not worked", async () => {
    await transitionProject(brandId, "paused", {}, db);
    await transitionProject(brandId, "closed", {}, db);

    const sheet = await sheetForWeek();
    expect(sheet.rows.map((row) => row.project.id)).toEqual([siteId]);
  });

  it("keeps non-chargeable time in the total and out of the billable figure", async () => {
    await createTimeEntry(
      {
        projectId: siteId,
        minutes: 120,
        workedOn: "2026-10-27",
        billable: false,
      },
      db,
    );

    const sheet = await sheetForWeek();
    expect(sheet.minutes).toBe(120);
    expect(sheet.billableMinutes).toBe(0);
  });

  it("gathers several entries on one day into one cell", async () => {
    await createTimeEntry(
      { projectId: siteId, minutes: 60, workedOn: "2026-10-27" },
      db,
    );
    await createTimeEntry(
      { projectId: siteId, minutes: 45, workedOn: "2026-10-27" },
      db,
    );

    const sheet = await sheetForWeek();
    const cell = sheet.rows[1].cells[1];
    expect(cell.entryCount).toBe(2);
    expect(cell.minutes).toBe(105);
  });

  it("gives an active project a row with nothing logged against it", async () => {
    const sheet = await sheetForWeek();
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.minutes).toBe(0);
  });
});
