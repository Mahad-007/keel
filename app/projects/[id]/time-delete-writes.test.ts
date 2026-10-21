import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteTimeEntry, getTimeEntry } from "@/lib/data/time-entries";
import { projectPath } from "@/lib/projects/detail";
import { DELETE_TIME_PROBLEMS } from "@/lib/time/remove";

import { writeTimeEntryDelete } from "./time-writes";

/**
 * Mocked collaborators rather than a database: this function's own job is the
 * branching — whose entry is it, did the delete land, what does a refusal
 * mean — and the delete itself is tested where it lives.
 */
vi.mock("@/lib/data/deliverables", () => ({ getDeliverable: vi.fn() }));
vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/data/time-entries", () => ({
  createTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
  getTimeEntry: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const read = vi.mocked(getTimeEntry);
const removed = vi.mocked(deleteTimeEntry);
const revalidated = vi.mocked(revalidatePath);

const ENTRY = {
  id: "tme_1",
  projectId: "prj_engine",
  deliverableId: null,
  minutes: 90,
  note: null,
  workedOn: "2026-10-17",
  billable: true,
  billedInvoiceId: null,
  createdAt: "2026-10-17T18:00:00.000Z",
  updatedAt: "2026-10-17T18:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(ENTRY);
  removed.mockResolvedValue({ ok: true, entry: ENTRY });
});

describe("deleting one entry from a project's time", () => {
  it("deletes the entry the press named", async () => {
    const result = await writeTimeEntryDelete("prj_engine", "tme_1");

    expect(removed).toHaveBeenCalledWith("tme_1");
    expect(result).toEqual({ ok: true });
  });

  it("re-renders the page, which is where the row is read from", async () => {
    await writeTimeEntryDelete("prj_engine", "tme_1");
    expect(revalidated).toHaveBeenCalledWith(projectPath("prj_engine"));
  });
});

describe("an entry this page is not showing", () => {
  it("refuses an entry belonging to another project", async () => {
    // The project comes from the page's closure and the id from the press. The
    // comparison is the whole of what stops a POST reaching anybody's entry.
    read.mockResolvedValue({ ...ENTRY, projectId: "prj_other" });

    const result = await writeTimeEntryDelete("prj_engine", "tme_1");

    expect(result).toEqual({
      ok: false,
      problem: DELETE_TIME_PROBLEMS.missing,
    });
    expect(removed).not.toHaveBeenCalled();
  });

  it("refuses an id no entry has", async () => {
    read.mockResolvedValue(null);

    const result = await writeTimeEntryDelete("prj_engine", "tme_gone");

    expect(result.ok).toBe(false);
    expect(removed).not.toHaveBeenCalled();
  });

  it("refuses a press carrying no id without reading anything", async () => {
    const result = await writeTimeEntryDelete("prj_engine", "");

    expect(result.ok).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it("says the same thing either way", async () => {
    // Telling the two apart would tell a caller whether an id they guessed
    // exists somewhere in the database.
    read.mockResolvedValue({ ...ENTRY, projectId: "prj_other" });
    const foreign = await writeTimeEntryDelete("prj_engine", "tme_1");
    read.mockResolvedValue(null);
    const unknown = await writeTimeEntryDelete("prj_engine", "tme_1");

    expect(foreign).toEqual(unknown);
  });
});

describe("an entry an invoice has billed", () => {
  it("says so rather than telling the reader to try again", async () => {
    removed.mockResolvedValue({ ok: false, refusal: "billed" });

    const result = await writeTimeEntryDelete("prj_engine", "tme_1");

    expect(result).toEqual({
      ok: false,
      problem: DELETE_TIME_PROBLEMS.billed,
    });
  });

  it("leaves the page alone, because nothing about it changed", async () => {
    removed.mockResolvedValue({ ok: false, refusal: "billed" });
    await writeTimeEntryDelete("prj_engine", "tme_1");
    expect(revalidated).not.toHaveBeenCalled();
  });
});

describe("an entry that went between the read and the delete", () => {
  it("reports what was asked for rather than a failure", async () => {
    // Somebody else deleted it, or this was a second press of one button.
    // What the reader wanted is true.
    removed.mockResolvedValue({ ok: false, refusal: "no-such-entry" });

    const result = await writeTimeEntryDelete("prj_engine", "tme_1");

    expect(result).toEqual({ ok: true });
  });

  it("still re-renders the page, because the page is the stale part", async () => {
    removed.mockResolvedValue({ ok: false, refusal: "no-such-entry" });
    await writeTimeEntryDelete("prj_engine", "tme_1");
    expect(revalidated).toHaveBeenCalledWith(projectPath("prj_engine"));
  });
});

describe("a delete the driver refused", () => {
  it("tells the reader nothing was written and to try again", async () => {
    removed.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await writeTimeEntryDelete("prj_engine", "tme_1");

    expect(result).toEqual({
      ok: false,
      problem: DELETE_TIME_PROBLEMS.failed,
    });
    expect(revalidated).not.toHaveBeenCalled();
  });
});
