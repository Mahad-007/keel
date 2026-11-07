import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createProject } from "@/lib/data/projects";
import {
  createTimeEntry,
  listFilteredTimeEntries,
  markTimeEntryBilled,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { searchParamsRecord } from "@/lib/projects/query";

import { TIME_EXPORT_COLUMNS } from "./export";
import { timeLogCsvResponse } from "./export-response";
import {
  logEntryFilter,
  parseTimeLogQuery,
  TIME_EXPORT_PATH,
} from "./log-query";

/**
 * The export from one end to the other: a query string, two tables, and the
 * file a reader ends up with.
 *
 * The pure tests either side say what the formatter writes and what the parser
 * reads. What they cannot say is that the columns still come off a real joined
 * row, that the filters the page offers are the filters the file obeys, or —
 * the one that matters most — that a note somebody typed survives being
 * written and read back. A formatter tested only against its own output is
 * tested against itself.
 *
 * So the file is parsed here by something that is not `lib/csv.ts`: a small
 * RFC 4180 reader written for the test. If the two ever disagree about a quote
 * or a line break, this is where it shows up.
 */

/**
 * A CSV file read back into rows of fields.
 *
 * Deliberately naive and deliberately independent: quotes toggle, a doubled
 * quote inside a quoted field is one quote, and anything outside quotes that
 * is a comma or a line ending ends a field or a row.
 */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[at + 1] === '"') {
        field += '"';
        at += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && text[at + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      at += 1;
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

let db: Database;
let harbourId: string;
let siteId: string;
let pellId: string;
let brandId: string;

/**
 * The route's own three lines, against the test database.
 *
 * It starts from a query string rather than from a record of params, because
 * that is what the route starts from: a reader arrives with a URL, and
 * `searchParamsRecord` is the step that turns it into what the page's parser
 * reads. Handing the parser a record directly would test the export against
 * every URL except the one shape a browser sends.
 */
async function exportLog(search: string) {
  const url = new URL(`https://keel.test${TIME_EXPORT_PATH}?${search}`);
  const query = parseTimeLogQuery(searchParamsRecord(url.searchParams));
  const entries = await listFilteredTimeEntries(logEntryFilter(query), db);
  const response = timeLogCsvResponse(entries, query);
  const rows = readCsv(await response.text());

  return {
    response,
    rows,
    header: rows[0],
    body: rows.slice(1),
    filename: response.headers.get("Content-Disposition") ?? "",
  };
}

beforeEach(async () => {
  db = await createTestDb();

  harbourId = (await createClient({ name: "Harbour Co" }, db)).id;
  pellId = (await createClient({ name: "Pell & Sons, Ltd" }, db)).id;

  siteId = (
    await createProject({ clientId: harbourId, name: "Site rebuild" }, db)
  ).id;
  brandId = (
    await createProject({ clientId: pellId, name: "Brand, refreshed" }, db)
  ).id;

  await createTimeEntry(
    {
      projectId: siteId,
      minutes: 90,
      workedOn: "2026-10-16",
      note: 'Two calls, and the "rebuild" brief',
    },
    db,
  );
  await createTimeEntry(
    {
      projectId: siteId,
      minutes: 30,
      workedOn: "2026-10-02",
      note: "Fixed the header\nand the footer",
      billable: false,
    },
    db,
  );
  const billed = await createTimeEntry(
    { projectId: brandId, minutes: 120, workedOn: "2026-09-30", note: null },
    db,
  );
  await markTimeEntryBilled(billed.id, "inv_001", db);
});

describe("the time log export", () => {
  it("writes the header row and one row per entry", async () => {
    const { header, body } = await exportLog("");

    expect(header).toEqual([...TIME_EXPORT_COLUMNS]);
    expect(body).toHaveLength(3);
  });

  it("gives every row the columns the header promises", async () => {
    const { body } = await exportLog("");

    for (const row of body) {
      expect(row).toHaveLength(TIME_EXPORT_COLUMNS.length);
    }
  });

  it("reads a note's comma and quotes back exactly as typed", async () => {
    const { body } = await exportLog("from=2026-10-16");

    expect(body[0].at(-1)).toBe('Two calls, and the "rebuild" brief');
  });

  it("reads a note's line break back without splitting the row", async () => {
    const { body } = await exportLog("to=2026-10-02&from=2026-10-02");

    expect(body).toHaveLength(1);
    expect(body[0].at(-1)).toBe("Fixed the header\nand the footer");
  });

  it("reads a client's own comma back as one field", async () => {
    const { body } = await exportLog(`client=${pellId}`);

    expect(body[0][1]).toBe("Pell & Sons, Ltd");
    expect(body[0][2]).toBe("Brand, refreshed");
  });

  it("exports one project's time and nothing from its neighbours", async () => {
    const { body } = await exportLog(`project=${siteId}`);

    expect(body).toHaveLength(2);
    expect(body.map((row) => row[2])).toEqual([
      "Site rebuild",
      "Site rebuild",
    ]);
  });

  it("takes the first of a repeated filter, as the page's parser does", async () => {
    const { body } = await exportLog(`project=${siteId}&project=${brandId}`);

    expect(body).toHaveLength(2);
    expect(body.map((row) => row[2])).toEqual([
      "Site rebuild",
      "Site rebuild",
    ]);
  });

  it("exports the rows the date range admits, newest first", async () => {
    const { body } = await exportLog("from=2026-10-01&to=2026-10-31");

    expect(body.map((row) => row[0])).toEqual(["2026-10-16", "2026-10-02"]);
  });

  it("exports one client's time and names the file after the days", async () => {
    const { body, filename } = await exportLog(`client=${harbourId}&from=2026-10-01&to=2026-10-31`);

    expect(body).toHaveLength(2);
    expect(filename).toContain("keel-time-2026-10-01-to-2026-10-31.csv");
  });

  it("exports only chargeable time when that is the filter", async () => {
    const { body, filename } = await exportLog("billable=chargeable");

    expect(body.map((row) => row[5])).toEqual(["Yes", "Yes"]);
    expect(filename).toContain("chargeable.csv");
  });

  it("exports the time given away when that is the filter", async () => {
    const { body } = await exportLog("billable=free");

    expect(body).toHaveLength(1);
    expect(body[0][3]).toBe("30");
    expect(body[0][5]).toBe("No");
  });

  it("says in the row that an invoice has the time", async () => {
    const { body } = await exportLog(`project=${brandId}`);

    expect(body[0][6]).toBe("Yes");
    expect(body[0].join(",")).not.toContain("inv_001");
  });

  it("writes minutes and hours of the same duration", async () => {
    const { body } = await exportLog("from=2026-10-16");

    expect(body[0][3]).toBe("90");
    expect(body[0][4]).toBe("1.50");
  });

  it("leaves the note cell empty for an entry without one", async () => {
    const { body } = await exportLog(`project=${brandId}`);

    expect(body[0].at(-1)).toBe("");
  });

  it("answers a filter that matched nothing with the header alone", async () => {
    const { header, body } = await exportLog("from=2027-01-01&to=2027-01-31");

    expect(header).toEqual([...TIME_EXPORT_COLUMNS]);
    expect(body).toHaveLength(0);
  });
});
