import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDeliverable } from "@/lib/data/deliverables";
import { getProject } from "@/lib/data/projects";
import { INITIAL_ADD_DELIVERABLE_STATE } from "@/lib/deliverables/form";

import { writeNewDeliverable } from "./scope-writes";

/**
 * Mocked collaborators rather than a database: the action's own job is the
 * branching — reject, fail, add — and the validation and the writing are each
 * already tested where they live.
 */
vi.mock("@/lib/data/deliverables", () => ({
  createDeliverable: vi.fn(),
  getDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
  setDeliverableStatus: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const written = vi.mocked(createDeliverable);
const loaded = vi.mocked(getProject);

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function add(values: Record<string, string>) {
  return writeNewDeliverable(
    "prj_engine",
    INITIAL_ADD_DELIVERABLE_STATE,
    submit(values),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  loaded.mockResolvedValue({
    id: "prj_engine",
    clientId: "cli_ada",
    name: "Engine rewrite",
    status: "active",
    contractValueCents: 1_200_000,
    rateCents: null,
    startedAt: "2026-09-28T09:00:00.000Z",
    closedAt: null,
    createdAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-09-28T09:00:00.000Z",
  });
  written.mockResolvedValue({
    id: "dlv_wire",
    projectId: "prj_engine",
    title: "Wireframes",
    description: "Six screens.",
    estimatedMinutes: 90,
    status: "pending",
    sortOrder: 0,
    createdAt: "2026-10-03T09:00:00.000Z",
    updatedAt: "2026-10-03T09:00:00.000Z",
  });
});

describe("adding a deliverable", () => {
  it("writes it to the project the page bound, not one the form named", async () => {
    await add({
      title: "Wireframes",
      description: "Six screens.",
      estimate: "1.5",
      projectId: "prj_somebody_else",
    });

    expect(written).toHaveBeenCalledWith({
      projectId: "prj_engine",
      title: "Wireframes",
      description: "Six screens.",
      estimatedMinutes: 90,
    });
  });

  it("names what landed and clears the line for the next one", async () => {
    const state = await add({ title: "Wireframes" });

    expect(state.added).toEqual({ id: "dlv_wire", title: "Wireframes" });
    expect(state.fields.title).toBe("");
    expect(state.formError).toBeNull();
  });

  it("revalidates the project page, where the list is", async () => {
    await add({ title: "Wireframes" });
    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });
});

describe("a deliverable that is rejected", () => {
  it("writes nothing and keeps what was typed", async () => {
    const state = await add({ title: "  ", estimate: "soon" });

    expect(written).not.toHaveBeenCalled();
    expect(state.errors.title).toBe("Title is required.");
    expect(state.fields.estimate).toBe("soon");
    expect(state.added).toBeNull();
  });

  it("does not revalidate a page nothing changed on", async () => {
    await add({ title: "" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("a deliverable that cannot be saved", () => {
  beforeEach(() => {
    written.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("says so without losing the line that was typed", async () => {
    const state = await add({ title: "Wireframes", estimate: "1.5" });

    expect(state.formError).toBe(
      "Could not add that deliverable. Nothing was written — try again.",
    );
    expect(state.fields.title).toBe("Wireframes");
    expect(state.fields.estimate).toBe("1.5");
    expect(state.added).toBeNull();
  });

  it("does not claim the page changed", async () => {
    await add({ title: "Wireframes" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the driver error in the logs", async () => {
    await add({ title: "Wireframes" });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("adding scope to a project that has gone", () => {
  beforeEach(() => {
    loaded.mockResolvedValue(null);
  });

  it("says so rather than advising a retry that cannot work", async () => {
    const state = await add({ title: "Wireframes" });

    expect(state.formError).toBe(
      "That project no longer exists, so there is nothing to add scope to.",
    );
    expect(state.fields.title).toBe("Wireframes");
  });

  it("does not attempt the write", async () => {
    await add({ title: "Wireframes" });
    expect(written).not.toHaveBeenCalled();
  });
});
