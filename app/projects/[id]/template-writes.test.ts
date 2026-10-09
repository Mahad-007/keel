import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTemplateToProject,
  saveTemplateFromProject,
} from "@/lib/data/deliverable-templates";
import type { TemplateApplyResult } from "@/lib/data/deliverable-templates";
import { projectPath } from "@/lib/projects/detail";
import {
  APPLY_PROBLEMS,
  INITIAL_APPLY_TEMPLATE_STATE,
} from "@/lib/templates/apply-form";
import {
  initialSaveTemplateState,
  SAVE_PROBLEMS,
} from "@/lib/templates/form";

import {
  writeAppliedTemplate,
  writeTemplateFromProject,
} from "./template-writes";

/** The rows an apply hands back; the write only ever counts them. */
type TemplateApplyDeliverables = Extract<
  TemplateApplyResult,
  { ok: true }
>["deliverables"];

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
const applied = vi.mocked(applyTemplateToProject);

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

  it("names the bad line when an estimate is below zero", async () => {
    captured.mockResolvedValue({ ok: false, reason: "negative-estimate" });

    const state = await save({ name: "Engine rewrite", description: "" });

    expect(state.formError).toBe(SAVE_PROBLEMS.negativeEstimate);
    expect(state.formError).not.toContain("try again");
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

describe("writeAppliedTemplate", () => {
  const OFFERED = ["tpl_engine", "tpl_retainer"];

  const APPLIED = {
    ok: true as const,
    template: {
      id: "tpl_engine",
      name: "Engine rewrite",
      description: null,
      createdAt: "2026-10-09T09:00:00.000Z",
      updatedAt: "2026-10-09T09:00:00.000Z",
    },
    deliverables: [
      { id: "dlv_discovery", title: "Discovery" },
      { id: "dlv_build", title: "Build" },
    ] as unknown as TemplateApplyDeliverables,
  };

  function apply(values: Record<string, string>, offered = OFFERED) {
    return writeAppliedTemplate(
      "prj_engine",
      offered,
      INITIAL_APPLY_TEMPLATE_STATE,
      submit(values),
    );
  }

  beforeEach(() => {
    applied.mockResolvedValue(APPLIED);
  });

  it("applies the picked template to the project it was given", async () => {
    const state = await apply({ template: "tpl_engine" });

    expect(applied).toHaveBeenCalledWith("tpl_engine", "prj_engine");
    expect(state.applied).toEqual({
      id: "tpl_engine",
      name: "Engine rewrite",
      deliverableIds: ["dlv_discovery", "dlv_build"],
    });
  });

  it("revalidates the page the new lines belong to", async () => {
    await apply({ template: "tpl_engine" });

    expect(revalidatePath).toHaveBeenCalledWith(projectPath("prj_engine"));
  });

  it("refuses a template the page never offered", async () => {
    const state = await apply({ template: "tpl_somebody_elses" });

    expect(applied).not.toHaveBeenCalled();
    expect(state.errors.template).toContain("no longer on the list");
    expect(state.applied).toBeNull();
  });

  it("asks for a template when the picker was left alone", async () => {
    const state = await apply({ template: "" });

    expect(applied).not.toHaveBeenCalled();
    expect(state.errors.template).toBe("Template is required.");
  });

  it("says the template has gone when it was deleted mid-press", async () => {
    applied.mockResolvedValue({ ok: false, reason: "no-such-template" });

    const state = await apply({ template: "tpl_engine" });

    expect(state.formError).toBe(APPLY_PROBLEMS.missingTemplate);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says the project has gone when it was deleted mid-press", async () => {
    applied.mockResolvedValue({ ok: false, reason: "no-such-project" });

    const state = await apply({ template: "tpl_engine" });

    expect(state.formError).toBe(APPLY_PROBLEMS.missingProject);
  });

  it("says so rather than reporting success for a lineless template", async () => {
    applied.mockResolvedValue({ ok: false, reason: "empty-template" });

    const state = await apply({ template: "tpl_engine" });

    expect(state.formError).toBe(APPLY_PROBLEMS.emptyTemplate);
  });

  it("turns a driver error into a sentence rather than a crash", async () => {
    applied.mockRejectedValue(new Error("database is locked"));

    const state = await apply({ template: "tpl_engine" });

    expect(state.formError).toBe(APPLY_PROBLEMS.failed);
  });

  it("ignores a project id posted alongside the picked template", async () => {
    await apply({ template: "tpl_engine", projectId: "prj_somebody_elses" });

    expect(applied).toHaveBeenCalledWith("tpl_engine", "prj_engine");
  });
});
