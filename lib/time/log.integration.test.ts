import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createProject, listProjectsWithClient } from "@/lib/data/projects";
import {
  createTimeEntry,
  listFilteredTimeEntries,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { describeLog, describeLogScope, summarizeLog } from "./log";
import {
  clientFilterOptions,
  projectFilterOptions,
  resolveLogFilters,
} from "./log-options";
import { logEntryFilter, parseTimeLogQuery } from "./log-query";

/**
 * The seam the time log is made of: a URL on one side, two tables on the
 * other, and a heading that has to describe what came back.
 *
 * The pure tests either side of this one say what the parsing does and what
 * the arithmetic does. What they cannot say is that `TimeEntryWithNames` still
 * describes a real joined row, that the filter object the parser produces is
 * still the one the query reads, or that the ids the pickers offer are the ids
 * the filters match on. All three are structural — the sort of thing that
 * compiles for a year and then stops when a column is renamed.
 *
 * So the log is built here the way the page builds it: params in, through the
 * same translation, the same query and the same summary.
 */

let db: Database;
let harbourId: string;
let pellId: string;
let siteId: string;
let brandId: string;

/** The page's own path, in one call, so a test reads like the URL it is about. */
async function log(params: Record<string, string>) {
  const query = parseTimeLogQuery(params);
  const [projects, entries] = await Promise.all([
    listProjectsWithClient({}, db),
    listFilteredTimeEntries(logEntryFilter(query), db),
  ]);

  const clients = clientFilterOptions(projects);
  const projectOptions = projectFilterOptions(projects, query.clientId);
  const resolved = resolveLogFilters(query, projects);

  return {
    entries,
    summary: describeLog(summarizeLog(entries)),
    scope: describeLogScope({
      range: query.range,
      billable: query.billable,
      project: resolved.project,
      client: resolved.client,
    }),
    resolved,
    clients,
    projectOptions,
  };
}

beforeEach(async () => {
  db = await createTestDb();

  const harbour = await createClient({ name: "Harbour Co" }, db);
  harbourId = harbour.id;
  const pell = await createClient({ name: "Pell & Sons" }, db);
  pellId = pell.id;

  const site = await createProject(
    { clientId: harbourId, name: "Site rebuild" },
    db,
  );
  siteId = site.id;
  const brand = await createProject(
    { clientId: pellId, name: "Brand refresh" },
    db,
  );
  brandId = brand.id;

  await createTimeEntry(
    { projectId: siteId, minutes: 90, workedOn: "2026-10-01", note: "Kickoff" },
    db,
  );
  await createTimeEntry(
    { projectId: siteId, minutes: 240, workedOn: "2026-10-02" },
    db,
  );
  await createTimeEntry(
    {
      projectId: siteId,
      minutes: 30,
      workedOn: "2026-10-16",
      billable: false,
    },
    db,
  );
  await createTimeEntry(
    { projectId: brandId, minutes: 120, workedOn: "2026-10-31" },
    db,
  );
  await createTimeEntry(
    { projectId: brandId, minutes: 45, workedOn: "2026-11-01" },
    db,
  );
});

describe("the time log, from search params to figures", () => {
  it("shows everything when the URL carries no filters", async () => {
    const { entries, scope, summary } = await log({});

    expect(entries).toHaveLength(5);
    expect(scope).toBe("All time");
    expect(summary).toBe(
      "5 entries, 8h 45m over 5 days across 2 projects, 30m of it not chargeable.",
    );
  });

  it("narrows to a month and says so in the heading", async () => {
    const { entries, scope, summary } = await log({
      from: "2026-10-01",
      to: "2026-10-31",
    });

    expect(entries).toHaveLength(4);
    expect(scope).toBe("Oct 1 – 31, 2026");
    expect(summary).toBe(
      "4 entries, 8h over 4 days across 2 projects, 30m of it not chargeable.",
    );
  });

  it("narrows to a client by the id its own picker offers", async () => {
    const { clients } = await log({});
    const harbour = clients.find((option) => option.label === "Harbour Co");

    const { entries, scope } = await log({ client: harbour?.value ?? "" });

    expect(entries.every((entry) => entry.clientId === harbourId)).toBe(true);
    expect(scope).toBe("All time · Harbour Co");
  });

  it("narrows to a project by the id its own picker offers", async () => {
    const { projectOptions } = await log({});
    const brand = projectOptions.find((option) =>
      option.label.endsWith("Brand refresh"),
    );

    const { entries, scope } = await log({ project: brand?.value ?? "" });

    expect(entries.map((entry) => entry.projectName)).toEqual([
      "Brand refresh",
      "Brand refresh",
    ]);
    expect(scope).toBe("All time · Pell & Sons — Brand refresh");
  });

  it("drops the client's name from the picker once the client is filtered", async () => {
    const { projectOptions } = await log({ client: harbourId });

    expect(projectOptions).toEqual([
      { value: siteId, label: "Site rebuild" },
    ]);
  });

  it("narrows to what will not be charged for", async () => {
    const { entries, scope, summary } = await log({ billable: "free" });

    expect(entries).toHaveLength(1);
    expect(scope).toBe("All time · Not chargeable");
    expect(summary).toBe(
      "One entry, 30m on one day for one project, 30m of it not chargeable.",
    );
  });

  it("applies all four filters at once", async () => {
    const { entries, scope } = await log({
      from: "2026-10-01",
      to: "2026-10-31",
      client: harbourId,
      project: siteId,
      billable: "chargeable",
    });

    expect(entries.map((entry) => entry.note)).toEqual([null, "Kickoff"]);
    expect(scope).toBe(
      "Oct 1 – 31, 2026 · Harbour Co · Site rebuild · Chargeable",
    );
  });

  it("comes back empty, not wrong, when a project and a client disagree", async () => {
    const { entries, summary, resolved } = await log({
      client: pellId,
      project: siteId,
    });

    expect(entries).toEqual([]);
    expect(summary).toBe("Nothing logged.");
    /*
      The pair is the reason the log is empty, and neither filter is missing:
      both name something real. Calling the project gone would be false about a
      project sitting on the books.
    */
    expect(resolved.mismatched).toBe(true);
    expect(resolved.projectGone).toBe(false);
    expect(resolved.project).toBe("Site rebuild");
  });

  it("leaves a filter out of the heading when it names something gone", async () => {
    const { entries, scope } = await log({ project: "prj_gone" });

    expect(entries).toEqual([]);
    expect(scope).toBe("All time");
  });

  it("still shows the log when every param is mangled", async () => {
    const { entries, scope } = await log({
      from: "last Tuesday",
      to: "",
      billable: "maybe",
    });

    expect(entries).toHaveLength(5);
    expect(scope).toBe("All time");
  });
});
