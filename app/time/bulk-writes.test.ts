import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTimeEntries } from "@/lib/data/time-entries";
import { bulkCellName } from "@/lib/time/bulk";
import { BULK_PROBLEMS, initialBulkState } from "@/lib/time/bulk-form";
import { TIMESHEET_PATH } from "@/lib/time/week-query";

import { writeBulkTime } from "./bulk-writes";

/**
 * Mocked collaborators rather than a database. This function's own job is the
 * branching — refuse the sheet, refuse the press, write the lot — and the
 * parsing and the transaction are each tested where they live.
 */
vi.mock("@/lib/data/time-entries", () => ({ createTimeEntries: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const written = vi.mocked(createTimeEntries);

const MONDAY = "2026-10-26";
const TUESDAY = "2026-10-27";
const SITE = "prj_site";
const BRAND = "prj_brand";

/** The grid the page would have rendered: two projects, two days. */
const NAMES = [
  bulkCellName({ projectId: SITE, workedOn: MONDAY }),
  bulkCellName({ projectId: SITE, workedOn: TUESDAY }),
  bulkCellName({ projectId: BRAND, workedOn: MONDAY }),
  bulkCellName({ projectId: BRAND, workedOn: TUESDAY }),
];

function cell(projectId: string, workedOn: string): string {
  return bulkCellName({ projectId, workedOn });
}

function submit(values: Record<string, string>): FormData {
  const body = new FormData();
  for (const [name, value] of Object.entries(values)) body.set(name, value);
  return body;
}

function save(values: Record<string, string>) {
  return writeBulkTime(NAMES, initialBulkState(NAMES), submit(values));
}

function entry(id: string, minutes: number) {
  return {
    id,
    projectId: SITE,
    deliverableId: null,
    minutes,
    note: null,
    workedOn: MONDAY,
    billable: true,
    billedInvoiceId: null,
    createdAt: "2026-10-30T09:00:00.000Z",
    updatedAt: "2026-10-30T09:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  written.mockResolvedValue({ ok: true, entries: [entry("tme_1", 120)] });
});

describe("writeBulkTime", () => {
  it("writes one entry per typed cell, in grid order", async () => {
    written.mockResolvedValue({
      ok: true,
      entries: [entry("tme_1", 120), entry("tme_2", 30)],
    });

    await save({ [cell(SITE, TUESDAY)]: "30m", [cell(SITE, MONDAY)]: "2h" });

    expect(written).toHaveBeenCalledWith([
      { projectId: SITE, workedOn: MONDAY, minutes: 120 },
      { projectId: SITE, workedOn: TUESDAY, minutes: 30 },
    ]);
  });

  it("reports what landed, read back off the rows", async () => {
    written.mockResolvedValue({
      ok: true,
      entries: [entry("tme_1", 90), entry("tme_2", 30)],
    });

    const state = await save({ [cell(SITE, MONDAY)]: "90" });

    expect(state.saved).toEqual({
      entryIds: ["tme_1", "tme_2"],
      minutes: 120,
    });
  });

  it("empties the grid after a save", async () => {
    const state = await save({ [cell(SITE, MONDAY)]: "2h" });
    expect(state.fields[cell(SITE, MONDAY)]).toBe("");
    expect(state.formError).toBeNull();
  });

  it("revalidates the timesheet, where the new figures are read from", async () => {
    await save({ [cell(SITE, MONDAY)]: "2h" });
    expect(revalidatePath).toHaveBeenCalledWith(TIMESHEET_PATH);
  });

  it("refuses the whole sheet when one cell cannot be read", async () => {
    const state = await save({
      [cell(SITE, MONDAY)]: "2h",
      [cell(BRAND, TUESDAY)]: "1,5h",
    });

    expect(written).not.toHaveBeenCalled();
    expect(state.errors[cell(BRAND, TUESDAY)]).toBeDefined();
    expect(state.errors[cell(SITE, MONDAY)]).toBeUndefined();
    expect(state.saved).toBeNull();
  });

  it("keeps every figure that was typed when it refuses one", async () => {
    const state = await save({
      [cell(SITE, MONDAY)]: "2h",
      [cell(BRAND, TUESDAY)]: "1,5h",
    });

    expect(state.fields[cell(SITE, MONDAY)]).toBe("2h");
    expect(state.fields[cell(BRAND, TUESDAY)]).toBe("1,5h");
  });

  it("names a project that went while the sheet sat open", async () => {
    written.mockResolvedValue({ ok: false, reason: "no-such-project" });

    const state = await save({ [cell(BRAND, MONDAY)]: "2h" });

    expect(state.formError).toBe(BULK_PROBLEMS.missingProject);
    expect(state.saved).toBeNull();
  });

  it("keeps the figures when the write is refused, with nothing to reload from", async () => {
    written.mockResolvedValue({ ok: false, reason: "no-such-project" });

    const state = await save({ [cell(BRAND, MONDAY)]: "2h" });

    expect(state.fields[cell(BRAND, MONDAY)]).toBe("2h");
  });

  it("leaves the sheet unrevalidated when nothing was written", async () => {
    written.mockResolvedValue({ ok: false, reason: "no-such-project" });

    await save({ [cell(BRAND, MONDAY)]: "2h" });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says nothing landed when the transaction itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    written.mockRejectedValue(new Error("database is locked"));

    const state = await save({ [cell(SITE, MONDAY)]: "2h" });

    expect(state.formError).toBe(BULK_PROBLEMS.failed);
    expect(state.fields[cell(SITE, MONDAY)]).toBe("2h");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps a driver error in the logs for whoever has to look", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("database is locked");
    written.mockRejectedValue(failure);

    await save({ [cell(SITE, MONDAY)]: "2h" });

    expect(logged).toHaveBeenCalledWith(expect.any(String), failure);
  });

  it("says what a blank cell means rather than writing nothing", async () => {
    const state = await save({ [cell(SITE, MONDAY)]: "   " });

    expect(written).not.toHaveBeenCalled();
    expect(state.formError).toBe(BULK_PROBLEMS.nothingTyped);
    expect(state.saved).toBeNull();
  });

  it("never looks at a cell the grid did not offer", async () => {
    const state = await save({
      [cell("prj_elsewhere", MONDAY)]: "8h",
      [cell(SITE, "2026-11-30")]: "8h",
    });

    expect(written).not.toHaveBeenCalled();
    expect(state.formError).toBe(BULK_PROBLEMS.nothingTyped);
  });
});
