import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDeliverable, getDeliverable } from "@/lib/data/deliverables";
import type { Deliverable } from "@/lib/db/schema";
import { SCOPE_PROBLEMS } from "@/lib/deliverables/arrange";

import { writeDeliverableDelete } from "./scope-writes";

/**
 * Mocked collaborators rather than a database. Removing the row and renumbering
 * the lines after it is one transaction tested in the data layer; what this
 * write adds is whose deliverable it is, and what to say when it is nobody's.
 */
vi.mock("@/lib/data/deliverables", () => ({
  createDeliverable: vi.fn(),
  deleteDeliverable: vi.fn(),
  getDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
  setDeliverableStatus: vi.fn(),
  updateDeliverable: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const loaded = vi.mocked(getDeliverable);
const deleted = vi.mocked(deleteDeliverable);

const wireframes: Deliverable = {
  id: "dlv_wire",
  projectId: "prj_engine",
  title: "Wireframes",
  description: null,
  estimatedMinutes: 90,
  status: "pending",
  sortOrder: 1,
  createdAt: "2026-10-03T09:00:00.000Z",
  updatedAt: "2026-10-03T09:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  loaded.mockResolvedValue(wireframes);
  deleted.mockResolvedValue(wireframes);
});

describe("deleting a deliverable", () => {
  it("deletes the row the press named", async () => {
    const result = await writeDeliverableDelete("prj_engine", "dlv_wire");

    expect(deleted).toHaveBeenCalledWith("dlv_wire");
    expect(result).toEqual({ ok: true });
  });

  it("revalidates the project the page bound, so the line disappears", async () => {
    await writeDeliverableDelete("prj_engine", "dlv_wire");

    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });

  it("does not complain about a row that had already gone", async () => {
    // A second press of the same button, or somebody else deleting it first.
    // What was asked for is true, so there is nothing to tell the reader.
    deleted.mockResolvedValue(null);
    const result = await writeDeliverableDelete("prj_engine", "dlv_wire");

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });
});

describe("a deletion aimed at a deliverable this page cannot touch", () => {
  it("refuses a row belonging to another project", async () => {
    loaded.mockResolvedValue({ ...wireframes, projectId: "prj_other" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await writeDeliverableDelete("prj_engine", "dlv_wire");

    expect(deleted).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.missing });
  });

  it("refuses a row that is not there at all", async () => {
    loaded.mockResolvedValue(null);
    const result = await writeDeliverableDelete("prj_engine", "dlv_gone");

    expect(deleted).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.missing });
  });

  it("refuses an id that is not a string, however it was posted", async () => {
    const result = await writeDeliverableDelete(
      "prj_engine",
      undefined as unknown as string,
    );

    expect(loaded).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.missing });
  });
});

describe("a deletion that could not be written", () => {
  it("says nothing was deleted and leaves the page alone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleted.mockRejectedValue(new Error("database is locked"));

    const result = await writeDeliverableDelete("prj_engine", "dlv_wire");

    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.failed });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
