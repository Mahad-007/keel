import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createProject, listProjectsWithClient } from "@/lib/data/projects";
import {
  createTimeEntries,
  listTimeEntriesInRange,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { bulkCellName, bulkCellNames, parseBulkCells } from "./bulk";
import { buildTimesheet, cellFigure } from "./timesheet";
import { weekOf } from "./week";

/**
 * The seam a bulk press is made of: a submitted grid of strings at one end, a
 * table of entries at the other, and the same grid read back out of it.
 *
 * `bulk.ts` is pure and its own tests say what the parse does.
 * `createTimeEntries` has its own tests and they say what the transaction
 * does. What neither of them can say is that a draft is still a thing
 * `createTimeEntry` accepts, or that a figure typed into a cell comes back out
 * of the same cell when the week is rebuilt — which is the one claim the whole
 * feature rests on, and the sort of thing that compiles for a year and then
 * stops when a field is renamed or a boundary moves by a day.
 */

const WEEK = weekOf("2026-10-19");

let db: Database;
let siteId: string;
let appId: string;

beforeEach(async () => {
  db = await createTestDb();

  const harbour = await createClient({ name: "Harbour Co" }, db);
  const bell = await createClient({ name: "Bell & Co" }, db);
  const site = await createProject(
    { clientId: harbour.id, name: "Site rebuild", status: "active" },
    db,
  );
  const app = await createProject(
    { clientId: bell.id, name: "App", status: "active" },
    db,
  );
  siteId = site.id;
  appId = app.id;
});

/** The week as the page builds it, over whatever rows this test has written. */
async function sheet() {
  const [projects, entries] = await Promise.all([
    listProjectsWithClient({}, db),
    listTimeEntriesInRange({ from: WEEK.start, to: WEEK.end }, db),
  ]);
  return buildTimesheet(WEEK, projects, entries);
}

/** What a project's row reads on one day of the week. */
function figureAt(
  built: Awaited<ReturnType<typeof sheet>>,
  projectId: string,
  workedOn: string,
): string {
  const row = built.rows.find((candidate) => candidate.project.id === projectId);
  const cell = row?.cells.find((candidate) => candidate.workedOn === workedOn);
  return cell === undefined ? "missing" : cellFigure(cell);
}

describe("a sheet typed, written and read back", () => {
  it("puts every typed figure in the cell it was typed into", async () => {
    const names = bulkCellNames([siteId, appId], WEEK.days);
    const parsed = parseBulkCells(names, {
      [bulkCellName({ projectId: siteId, workedOn: "2026-10-19" })]: "2h",
      [bulkCellName({ projectId: siteId, workedOn: "2026-10-21" })]: "1h30m",
      [bulkCellName({ projectId: appId, workedOn: "2026-10-23" })]: "45",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = await createTimeEntries(
      parsed.value.map((draft) => ({ ...draft })),
      db,
    );
    expect(result.ok).toBe(true);

    const built = await sheet();
    expect(figureAt(built, siteId, "2026-10-19")).toBe("2h");
    expect(figureAt(built, siteId, "2026-10-21")).toBe("1h 30m");
    expect(figureAt(built, appId, "2026-10-23")).toBe("45m");
  });

  it("leaves the cells nobody typed into empty", async () => {
    const names = bulkCellNames([siteId, appId], WEEK.days);
    const parsed = parseBulkCells(names, {
      [bulkCellName({ projectId: siteId, workedOn: "2026-10-19" })]: "2h",
    });
    if (!parsed.ok) return;
    await createTimeEntries(parsed.value.map((draft) => ({ ...draft })), db);

    const built = await sheet();
    expect(figureAt(built, siteId, "2026-10-20")).toBe("–");
    expect(figureAt(built, appId, "2026-10-19")).toBe("–");
  });

  it("adds to the week total rather than replacing it", async () => {
    const names = bulkCellNames([siteId], WEEK.days);
    const monday = bulkCellName({ projectId: siteId, workedOn: "2026-10-19" });

    for (const typed of ["2h", "30m"]) {
      const parsed = parseBulkCells(names, { [monday]: typed });
      if (!parsed.ok) return;
      await createTimeEntries(parsed.value.map((draft) => ({ ...draft })), db);
    }

    const built = await sheet();
    expect(figureAt(built, siteId, "2026-10-19")).toBe("2h 30m");
    expect(built.minutes).toBe(150);
    expect(built.entryCount).toBe(2);
  });
});
