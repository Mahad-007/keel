import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDeliverable, moveDeliverable } from "@/lib/data/deliverables";
import type { Deliverable } from "@/lib/db/schema";
import { SCOPE_PROBLEMS } from "@/lib/deliverables/arrange";

import { moveDeliverableAction } from "./scope-actions";

/**
 * Mocked collaborators rather than a database. The arithmetic of a move and the
 * conditional write behind a status press are both tested where they live; what
 * these actions add is the branching around them — whose deliverable it is,
 * what to say when it is nobody's, and when the page is worth revalidating.
 */
vi.mock("@/lib/data/deliverables", () => ({
  createDeliverable: vi.fn(),
  getDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const loaded = vi.mocked(getDeliverable);
const moved = vi.mocked(moveDeliverable);

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
  moved.mockResolvedValue([wireframes]);
});

describe("moving a deliverable", () => {
  it("moves the deliverable the press named, in the direction pressed", async () => {
    const result = await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(moved).toHaveBeenCalledWith("dlv_wire", "up");
    expect(result).toEqual({ ok: true });
  });

  it("moves it down when that is the button pressed", async () => {
    await moveDeliverableAction("prj_engine", "dlv_wire", "down");

    expect(moved).toHaveBeenCalledWith("dlv_wire", "down");
  });

  it("revalidates the project, so the server's order catches up", async () => {
    await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });
});
