import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDeliverable,
  moveDeliverable,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import type { Deliverable } from "@/lib/db/schema";
import { SCOPE_PROBLEMS } from "@/lib/deliverables/arrange";

import {
  changeDeliverableStatusAction,
  moveDeliverableAction,
} from "./scope-actions";

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
  setDeliverableStatus: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({ getProject: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const loaded = vi.mocked(getDeliverable);
const moved = vi.mocked(moveDeliverable);
const restated = vi.mocked(setDeliverableStatus);

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
  restated.mockResolvedValue({ ...wireframes, status: "started" });
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

describe("moving a deliverable that is not this project's", () => {
  it("refuses a deliverable belonging to another project", async () => {
    loaded.mockResolvedValue({ ...wireframes, projectId: "prj_somebody_else" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(moved).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.missing });
  });

  it("keeps a press aimed at another project in the logs", async () => {
    loaded.mockResolvedValue({ ...wireframes, projectId: "prj_somebody_else" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(console.warn).toHaveBeenCalled();
  });

  it("says the same thing about a deliverable that does not exist", async () => {
    loaded.mockResolvedValue(null);

    const result = await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(moved).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.missing });
  });

  it("revalidates nothing when it refuses", async () => {
    loaded.mockResolvedValue(null);

    await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports it gone if it is deleted between the read and the move", async () => {
    moved.mockResolvedValue(null);

    const result = await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.missing });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("a move the database refuses", () => {
  it("refuses a direction that is not one of the two", async () => {
    const result = await moveDeliverableAction(
      "prj_engine",
      "dlv_wire",
      "top" as "up",
    );

    expect(loaded).not.toHaveBeenCalled();
    expect(moved).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.unknown });
  });

  it("says a driver error could not be saved, and keeps it in the logs", async () => {
    moved.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(result).toEqual({ ok: false, problem: SCOPE_PROBLEMS.failed });
    expect(console.error).toHaveBeenCalled();
  });

  it("does not claim the page changed after a failed write", async () => {
    moved.mockRejectedValue(new Error("database is locked"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await moveDeliverableAction("prj_engine", "dlv_wire", "up");

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("advancing a deliverable's status", () => {
  it("writes the status the press asked for, from the one it was drawn at", async () => {
    const result = await changeDeliverableStatusAction(
      "prj_engine",
      "dlv_wire",
      "pending",
      "started",
    );

    expect(restated).toHaveBeenCalledWith("dlv_wire", "pending", "started");
    expect(result).toEqual({ ok: true });
  });

  it("revalidates the project, so the words beside the line catch up", async () => {
    await changeDeliverableStatusAction(
      "prj_engine",
      "dlv_wire",
      "pending",
      "started",
    );

    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });

  it("marks a started deliverable done", async () => {
    loaded.mockResolvedValue({ ...wireframes, status: "started" });
    restated.mockResolvedValue({ ...wireframes, status: "done" });

    const result = await changeDeliverableStatusAction(
      "prj_engine",
      "dlv_wire",
      "started",
      "done",
    );

    expect(restated).toHaveBeenCalledWith("dlv_wire", "started", "done");
    expect(result).toEqual({ ok: true });
  });

  it("puts a finished deliverable back on the list", async () => {
    loaded.mockResolvedValue({ ...wireframes, status: "done" });
    restated.mockResolvedValue({ ...wireframes, status: "pending" });

    const result = await changeDeliverableStatusAction(
      "prj_engine",
      "dlv_wire",
      "done",
      "pending",
    );

    expect(restated).toHaveBeenCalledWith("dlv_wire", "done", "pending");
    expect(result).toEqual({ ok: true });
  });
});
