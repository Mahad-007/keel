import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDeliverable, updateDeliverable } from "@/lib/data/deliverables";
import type { Deliverable } from "@/lib/db/schema";
import {
  EDIT_PROBLEMS,
  editDeliverableState,
} from "@/lib/deliverables/edit";

import { writeDeliverableEdit } from "./scope-writes";

/**
 * Mocked collaborators rather than a database. Validating the fields and
 * writing the patch are both tested where they live; what this write adds is
 * the branching around them — whose deliverable it is, whether anything
 * actually changed, and when the page is worth revalidating.
 */
vi.mock("@/lib/data/deliverables", () => ({
  createDeliverable: vi.fn(),
  getDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
  setDeliverableStatus: vi.fn(),
  updateDeliverable: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const loaded = vi.mocked(getDeliverable);
const saved = vi.mocked(updateDeliverable);

const wireframes: Deliverable = {
  id: "dlv_wire",
  projectId: "prj_engine",
  title: "Wireframes",
  description: "Six screens.",
  estimatedMinutes: 90,
  status: "pending",
  sortOrder: 1,
  createdAt: "2026-10-03T09:00:00.000Z",
  updatedAt: "2026-10-03T09:00:00.000Z",
};

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

/** The form as it opens on the stored line, with whatever was changed. */
function edit(values: Record<string, string>, projectId = "prj_engine") {
  const fields = editDeliverableState(wireframes).fields;
  return writeDeliverableEdit(
    projectId,
    editDeliverableState(wireframes),
    submit({ id: wireframes.id, ...fields, ...values }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  loaded.mockResolvedValue(wireframes);
  saved.mockImplementation(async (_id, patch) => ({ ...wireframes, ...patch }));
});

describe("saving an edit", () => {
  it("patches only the field that changed", async () => {
    await edit({ title: "Wireframes, revised" });

    expect(saved).toHaveBeenCalledWith("dlv_wire", {
      title: "Wireframes, revised",
    });
  });

  it("comes back with the row as saved, so the list can close the form", async () => {
    const state = await edit({ estimate: "2" });

    expect(state.saved).toEqual({
      id: "dlv_wire",
      title: "Wireframes",
      changed: true,
    });
    expect(state.fields.estimate).toBe("2");
    expect(state.formError).toBeNull();
  });

  it("revalidates the project the page bound, so the line re-renders", async () => {
    await edit({ title: "Flows" });

    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });

  it("names the title as saved rather than as submitted", async () => {
    // The data layer trims, and the sentence said out loud afterwards has to
    // name the line as it now reads.
    saved.mockResolvedValue({ ...wireframes, title: "Flows" });
    const state = await edit({ title: "  Flows  " });

    expect(state.saved?.title).toBe("Flows");
  });

  it("clears a description back to nothing when the box was emptied", async () => {
    await edit({ description: "" });

    expect(saved).toHaveBeenCalledWith("dlv_wire", { description: null });
  });
});

describe("an edit that changed nothing", () => {
  it("does not write, so the line does not claim to have been edited", async () => {
    await edit({});

    expect(saved).not.toHaveBeenCalled();
  });

  it("does not revalidate a page nothing happened to", async () => {
    await edit({});

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("still closes the form, saying there was nothing to save", async () => {
    const state = await edit({});

    expect(state.saved).toEqual({
      id: "dlv_wire",
      title: "Wireframes",
      changed: false,
    });
  });

  it("treats whitespace around a title as no change at all", async () => {
    await edit({ title: "  Wireframes  " });

    expect(saved).not.toHaveBeenCalled();
  });
});
