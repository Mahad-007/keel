import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveTemplateFromProject } from "@/lib/data/deliverable-templates";
import { projectPath } from "@/lib/projects/detail";
import {
  initialSaveTemplateState,
  SAVE_PROBLEMS,
} from "@/lib/templates/form";

import { writeTemplateFromProject } from "./template-writes";

/**
 * Mocked collaborators rather than a database: the write's own job is the
 * branching — reject, refuse, save — and the validation and the capture are
 * each already tested where they live.
 */
vi.mock("@/lib/data/deliverable-templates", () => ({
  saveTemplateFromProject: vi.fn(),
  applyTemplateToProject: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const captured = vi.mocked(saveTemplateFromProject);

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function save(values: Record<string, string>) {
  return writeTemplateFromProject(
    "prj_engine",
    initialSaveTemplateState("Engine rewrite"),
    submit(values),
  );
}

const SAVED = {
  ok: true as const,
  template: {
    id: "tpl_engine",
    name: "Engine rewrite",
    description: null,
    createdAt: "2026-10-09T09:00:00.000Z",
    updatedAt: "2026-10-09T09:00:00.000Z",
  },
  lineCount: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  captured.mockResolvedValue(SAVED);
});

describe("writeTemplateFromProject", () => {
  it("saves the project's scope under the submitted name", async () => {
    const state = await save({ name: "Engine rewrite", description: "" });

    expect(captured).toHaveBeenCalledWith("prj_engine", {
      name: "Engine rewrite",
      description: null,
    });
    expect(state.saved).toEqual({
      id: "tpl_engine",
      name: "Engine rewrite",
      lineCount: 3,
    });
  });

  it("revalidates the page, whose picker now has one more option", async () => {
    await save({ name: "Engine rewrite", description: "" });

    expect(revalidatePath).toHaveBeenCalledWith(projectPath("prj_engine"));
  });

  it("writes nothing when the form is wrong", async () => {
    const state = await save({ name: "  ", description: "" });

    expect(captured).not.toHaveBeenCalled();
    expect(state.errors.name).toBe("Template name is required.");
    expect(state.saved).toBeNull();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps what was typed when the form is wrong", async () => {
    const state = await save({ name: "", description: "The usual three." });

    expect(state.fields.description).toBe("The usual three.");
  });

  it("says there is nothing to save when the project has no scope", async () => {
    captured.mockResolvedValue({ ok: false, reason: "empty-scope" });

    const state = await save({ name: "Engine rewrite", description: "" });

    expect(state.formError).toBe(SAVE_PROBLEMS.emptyScope);
    expect(state.saved).toBeNull();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says the project is gone when the capture cannot find it", async () => {
    captured.mockResolvedValue({ ok: false, reason: "no-such-project" });

    const state = await save({ name: "Engine rewrite", description: "" });

    expect(state.formError).toBe(SAVE_PROBLEMS.missingProject);
  });

  it("turns a driver error into a sentence rather than a crash", async () => {
    captured.mockRejectedValue(new Error("database is locked"));

    const state = await save({ name: "Engine rewrite", description: "" });

    expect(state.formError).toBe(SAVE_PROBLEMS.failed);
    expect(state.fields.name).toBe("Engine rewrite");
  });

  it("saves against the project it was given, not one from the form", async () => {
    await save({
      name: "Engine rewrite",
      description: "",
      projectId: "prj_somebody_elses",
    });

    expect(captured).toHaveBeenCalledWith("prj_engine", expect.anything());
  });
});
