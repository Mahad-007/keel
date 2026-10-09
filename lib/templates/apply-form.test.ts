import { describe, expect, it } from "vitest";

import {
  APPLY_PROBLEMS,
  appliedTemplateNotice,
  appliedTemplateState,
  failedApplyState,
  INITIAL_APPLY_TEMPLATE_STATE,
  parseApplyTemplateForm,
  readApplyFields,
  rejectedApplyState,
} from "./apply-form";

const OFFERED = ["tpl_web", "tpl_ret"];

describe("parseApplyTemplateForm", () => {
  it("accepts a template that was on offer", () => {
    const parsed = parseApplyTemplateForm({ template: "tpl_ret" }, OFFERED);

    expect(parsed).toEqual({ ok: true, value: { templateId: "tpl_ret" } });
  });

  it("asks for a template when the picker was left on the placeholder", () => {
    const parsed = parseApplyTemplateForm({ template: "" }, OFFERED);

    expect(!parsed.ok && parsed.errors.template).toBe("Template is required.");
  });

  it("blames a stale page for an id that was never offered", () => {
    const parsed = parseApplyTemplateForm({ template: "tpl_gone" }, OFFERED);

    expect(!parsed.ok && parsed.errors.template).toContain(
      "no longer on the list",
    );
  });

  it("offers nothing to pick when there are no templates", () => {
    const parsed = parseApplyTemplateForm({ template: "tpl_web" }, []);

    expect(parsed.ok).toBe(false);
  });
});

describe("readApplyFields", () => {
  it("reads the picked template", () => {
    const formData = new FormData();
    formData.set("template", "tpl_web");

    expect(readApplyFields(formData)).toEqual({ template: "tpl_web" });
  });

  it("reads a picker the browser never sent as blank", () => {
    expect(readApplyFields(new FormData())).toEqual({ template: "" });
  });
});

describe("appliedTemplateState", () => {
  it("carries what landed and puts the picker back on its placeholder", () => {
    const state = appliedTemplateState({
      id: "tpl_web",
      name: "Website build",
      deliverableIds: ["dlv_1", "dlv_2"],
    });

    expect(state.applied?.deliverableIds).toEqual(["dlv_1", "dlv_2"]);
    expect(state.fields.template).toBe("");
    expect(state.formError).toBeNull();
  });
});

describe("rejectedApplyState", () => {
  it("keeps the picked value and marks the field", () => {
    const state = rejectedApplyState(
      { template: "tpl_gone" },
      { template: "That template is no longer on the list." },
    );

    expect(state.fields.template).toBe("tpl_gone");
    expect(state.errors.template).toContain("no longer on the list");
    expect(state.applied).toBeNull();
  });
});

describe("failedApplyState", () => {
  it("carries the problem and applies nothing", () => {
    const state = failedApplyState(
      { template: "tpl_web" },
      APPLY_PROBLEMS.missingTemplate,
    );

    expect(state.formError).toBe(APPLY_PROBLEMS.missingTemplate);
    expect(state.errors).toEqual({});
    expect(state.applied).toBeNull();
  });
});

describe("appliedTemplateNotice", () => {
  it("names the template, the count, and where the lines went", () => {
    const notice = appliedTemplateNotice(
      appliedTemplateState({
        id: "tpl_web",
        name: "Website build",
        deliverableIds: ["a", "b", "c", "d", "e"],
      }),
    );

    expect(notice).toBe(
      "Added 5 deliverables from “Website build” to the end of the scope list.",
    );
  });

  it("agrees the noun with a template of one line", () => {
    const notice = appliedTemplateNotice(
      appliedTemplateState({
        id: "tpl_one",
        name: "Kickoff",
        deliverableIds: ["dlv_only"],
      }),
    );

    expect(notice).toBe(
      "Added one deliverable from “Kickoff” to the end of the scope list.",
    );
  });

  it("has nothing to say before anything is applied", () => {
    expect(appliedTemplateNotice(INITIAL_APPLY_TEMPLATE_STATE)).toBeNull();
  });
});
