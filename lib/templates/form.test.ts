import { describe, expect, it } from "vitest";

import {
  parseTemplateForm,
  readTemplateFields,
  TEMPLATE_FIELD_LIMITS,
} from "./form";

function fields(overrides: Partial<Record<"name" | "description", string>> = {}) {
  return { name: "Website build", description: "", ...overrides };
}

describe("parseTemplateForm", () => {
  it("accepts a name on its own", () => {
    const parsed = parseTemplateForm(fields());

    expect(parsed).toEqual({
      ok: true,
      value: { name: "Website build", description: null },
    });
  });

  it("trims the name rather than storing the whitespace", () => {
    const parsed = parseTemplateForm(fields({ name: "  Retainer month  " }));

    expect(parsed.ok && parsed.value.name).toBe("Retainer month");
  });

  it("rejects a name of only spaces", () => {
    const parsed = parseTemplateForm(fields({ name: "   " }));

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.errors.name).toBe("Template name is required.");
  });

  it("keeps a description when there is one", () => {
    const parsed = parseTemplateForm(
      fields({ description: "  Two workshops and a build.  " }),
    );

    expect(parsed.ok && parsed.value.description).toBe(
      "Two workshops and a build.",
    );
  });

  it("refuses a name past the limit the input enforces", () => {
    const parsed = parseTemplateForm(
      fields({ name: "x".repeat(TEMPLATE_FIELD_LIMITS.name + 1) }),
    );

    expect(!parsed.ok && parsed.errors.name).toContain(
      `${TEMPLATE_FIELD_LIMITS.name} characters or fewer`,
    );
  });

  it("refuses a description past its limit", () => {
    const parsed = parseTemplateForm(
      fields({ description: "x".repeat(TEMPLATE_FIELD_LIMITS.description + 1) }),
    );

    expect(!parsed.ok && parsed.errors.description).toContain(
      `${TEMPLATE_FIELD_LIMITS.description} characters or fewer`,
    );
  });

  it("reports both fields at once rather than one per submission", () => {
    const parsed = parseTemplateForm({
      name: "",
      description: "x".repeat(TEMPLATE_FIELD_LIMITS.description + 1),
    });

    expect(!parsed.ok && Object.keys(parsed.errors).sort()).toEqual([
      "description",
      "name",
    ]);
  });
});

describe("readTemplateFields", () => {
  it("reads both fields as submitted", () => {
    const formData = new FormData();
    formData.set("name", "Retainer month");
    formData.set("description", "The usual four lines.");

    expect(readTemplateFields(formData)).toEqual({
      name: "Retainer month",
      description: "The usual four lines.",
    });
  });

  it("reads a field the browser never sent as blank", () => {
    expect(readTemplateFields(new FormData())).toEqual({
      name: "",
      description: "",
    });
  });
});
