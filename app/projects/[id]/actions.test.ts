import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProject, transitionProject } from "@/lib/data/projects";
import type { Project } from "@/lib/db/schema";
import { INITIAL_TRANSITION_FORM_STATE } from "@/lib/projects/transition-form";

import { transitionProjectAction } from "./actions";

/**
 * Mocked collaborators, like the other project actions: the branching here is
 * this file's job, and the guard, the form parser and the write are tested
 * where they live.
 */
vi.mock("@/lib/data/projects", () => ({
  getProject: vi.fn(),
  transitionProject: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const read = vi.mocked(getProject);
const moved = vi.mocked(transitionProject);

const STORED: Project = {
  id: "prj_engine",
  clientId: "cli_ada",
  name: "Engine rewrite",
  status: "active",
  contractValueCents: 1_200_000,
  rateCents: 18000,
  startedAt: "2026-09-01T09:00:00.000Z",
  closedAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
};

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function press(values: Record<string, string>) {
  return transitionProjectAction(
    STORED.id,
    INITIAL_TRANSITION_FORM_STATE,
    submit(values),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(STORED);
  moved.mockResolvedValue({ ok: true, project: { ...STORED, status: "paused" } });
});

describe("transitionProjectAction on a legal move", () => {
  it("moves the project and goes back to it", async () => {
    await expect(press({ status: "paused" })).rejects.toThrow(
      "NEXT_REDIRECT:/projects/prj_engine",
    );

    expect(moved).toHaveBeenCalledWith("prj_engine", "paused", {
      reason: null,
    });
  });

  it("passes the note along with the move", async () => {
    await expect(
      press({ status: "paused", reason: "  Waiting on copy.  " }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(moved).toHaveBeenCalledWith("prj_engine", "paused", {
      reason: "Waiting on copy.",
    });
  });

  it("revalidates the project and the list it is on", async () => {
    await expect(press({ status: "paused" })).rejects.toThrow(/NEXT_REDIRECT/);

    expect(revalidatePath).toHaveBeenCalledWith("/projects");
    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });
});

describe("transitionProjectAction on a submission it refuses", () => {
  it("writes nothing when the move is not one the project can make", async () => {
    const state = await press({ status: "draft" });

    expect(moved).not.toHaveBeenCalled();
    expect(state.errors.status).toBeDefined();
  });

  it("marks the reason box when a reopening says nothing", async () => {
    read.mockResolvedValue({ ...STORED, status: "closed" });

    const state = await press({ status: "active" });

    expect(moved).not.toHaveBeenCalled();
    expect(state.errors.reason).toMatch(/Say why/);
  });

  it("hands back what was typed, so a rejected reason is not lost", async () => {
    read.mockResolvedValue({ ...STORED, status: "closed" });

    const state = await press({ status: "active", reason: "x".repeat(600) });

    expect(state.fields.reason).toBe("x".repeat(600));
  });

  it("says so when the project was deleted while the page was open", async () => {
    read.mockResolvedValue(null);

    const state = await press({ status: "paused" });

    expect(moved).not.toHaveBeenCalled();
    expect(state.formError).toMatch(/no longer exists/);
  });

  it("reports the data layer's refusal when the project moved underneath", async () => {
    moved.mockResolvedValue({
      ok: false,
      problem: { code: "illegal", message: "This project is already closed." },
    });

    const state = await press({ status: "paused" });

    expect(state.formError).toBe("This project is already closed.");
    expect(state.errors).toEqual({});
  });

  it("keeps a driver error out of the user's face and in the logs", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    moved.mockRejectedValue(new Error("database is locked"));

    const state = await press({ status: "paused" });

    expect(state.formError).toMatch(/Nothing was written/);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
