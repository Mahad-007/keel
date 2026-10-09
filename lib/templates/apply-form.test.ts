import { describe, expect, it } from "vitest";

import {
  parseApplyTemplateForm,
  readApplyFields,
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
