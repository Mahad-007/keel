import { describe, expect, it } from "vitest";

import { UTF8_BOM } from "@/lib/csv";

import { ANY_BILLING, CHARGEABLE_TIME } from "./billable";
import { timeLogCsv, type ExportableEntry } from "./export";
import { timeLogCsvResponse } from "./export-response";
import { UNFILTERED_LOG, type TimeLogQuery } from "./log-query";

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

/**
 * The bytes the browser gets.
 *
 * `text()` decodes UTF-8 and strips a leading byte order mark as it goes, so a
 * test of the body as a string cannot see the mark at all — and the mark is
 * the one thing in the response that is about bytes rather than about text.
 */
async function bytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

const OCTOBER: TimeLogQuery = {
  range: { from: "2026-10-01", to: "2026-10-31" },
  projectId: null,
  clientId: null,
  billable: CHARGEABLE_TIME,
};

describe("timeLogCsvResponse", () => {
  it("answers with the export document", async () => {
    const entries = [entry()];
    const body = await timeLogCsvResponse(entries, UNFILTERED_LOG).text();

    expect(body).toBe(timeLogCsv(entries));
  });

  it("starts the file with the mark Excel reads the encoding from", async () => {
    const sent = await bytes(timeLogCsvResponse([], UNFILTERED_LOG));

    expect([...sent.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("writes the mark once, in front of the header row", async () => {
    const sent = await bytes(timeLogCsvResponse([entry()], UNFILTERED_LOG));
    /* `ignoreBOM` keeps the mark in the string; the default strips it. */
    const decoded = new TextDecoder("utf-8", { ignoreBOM: true }).decode(sent);

    expect(decoded).toBe(`${UTF8_BOM}${timeLogCsv([entry()])}`);
  });

  it("says the body is CSV in UTF-8", () => {
    const response = timeLogCsvResponse([], UNFILTERED_LOG);

    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
  });

  it("asks the browser to save it under the filters' own name", () => {
    const response = timeLogCsvResponse([], OCTOBER);

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="keel-time-2026-10-01-to-2026-10-31-chargeable.csv"',
    );
  });

  it("names an unfiltered export after all time", () => {
    const response = timeLogCsvResponse([], {
      ...UNFILTERED_LOG,
      billable: ANY_BILLING,
    });

    expect(response.headers.get("Content-Disposition")).toContain(
      "keel-time-all-time.csv",
    );
  });

  it("answers a filter that matched nothing with the header row alone", async () => {
    const body = await timeLogCsvResponse([], OCTOBER).text();

    expect(body).toBe(timeLogCsv([]));
    expect(body).toContain("Date,Client,Project");
  });

  it("does not re-filter the rows it was handed", async () => {
    const outside = [entry({ workedOn: "2025-01-01", billable: false })];
    const body = await timeLogCsvResponse(outside, OCTOBER).text();

    expect(body).toContain("2025-01-01");
  });

  it("keeps a filtered ledger out of every cache", () => {
    const response = timeLogCsvResponse([entry()], OCTOBER);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers 200, because an empty log is not a missing one", () => {
    expect(timeLogCsvResponse([], OCTOBER).status).toBe(200);
  });
});
