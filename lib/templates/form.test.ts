import { describe, expect, it } from "vitest";

import {
  EMPTY_TEMPLATE_FIELDS,
  failedSaveState,
  initialSaveTemplateState,
  parseTemplateForm,
  readTemplateFields,
  rejectedSaveState,
  SAVE_PROBLEMS,
  savedTemplateNotice,
  savedTemplateState,
  suggestedTemplateName,
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

describe("suggestedTemplateName", () => {
  it("suggests the project's own name", () => {
    expect(suggestedTemplateName("Harbour Co — site rebuild")).toBe(
      "Harbour Co — site rebuild",
    );
  });

  it("trims the suggestion", () => {
    expect(suggestedTemplateName("  Retainer month \n")).toBe("Retainer month");
  });

  it("cuts a project name longer than a template name may be", () => {
    const suggestion = suggestedTemplateName("x".repeat(400));

    expect(suggestion).toHaveLength(TEMPLATE_FIELD_LIMITS.name);
  });

  it("suggests a name the form would then accept", () => {
    const parsed = parseTemplateForm({
      name: suggestedTemplateName("y".repeat(400)),
      description: "",
    });

    expect(parsed.ok).toBe(true);
  });

  it("suggests nothing for a project named only whitespace", () => {
    expect(suggestedTemplateName("   ")).toBe("");
  });
});

describe("initialSaveTemplateState", () => {
  it("opens with the project's name in the name box", () => {
    const state = initialSaveTemplateState("Harbour Co — site rebuild");

    expect(state.fields.name).toBe("Harbour Co — site rebuild");
    expect(state.fields.description).toBe("");
  });

  it("opens with nothing saved and nothing wrong", () => {
    const state = initialSaveTemplateState("Rebuild");

    expect(state.saved).toBeNull();
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });
});

describe("savedTemplateState", () => {
  it("echoes the fields back and carries the saved template", () => {
    const state = savedTemplateState(
      { name: "Website build", description: "The usual." },
      { id: "tpl_1", name: "Website build", lineCount: 4 },
    );

    expect(state.fields.name).toBe("Website build");
    expect(state.saved).toEqual({
      id: "tpl_1",
      name: "Website build",
      lineCount: 4,
    });
    expect(state.formError).toBeNull();
  });
});

describe("rejectedSaveState", () => {
  it("keeps what was typed and says nothing was saved", () => {
    const state = rejectedSaveState(
      { name: "", description: "The usual." },
      { name: "Template name is required." },
    );

    expect(state.fields.description).toBe("The usual.");
    expect(state.errors.name).toBe("Template name is required.");
    expect(state.saved).toBeNull();
  });
});

describe("failedSaveState", () => {
  it("carries the problem and marks no field", () => {
    const state = failedSaveState(
      { name: "Website build", description: "" },
      SAVE_PROBLEMS.emptyScope,
    );

    expect(state.formError).toBe(SAVE_PROBLEMS.emptyScope);
    expect(state.errors).toEqual({});
    expect(state.saved).toBeNull();
  });
});

describe("savedTemplateNotice", () => {
  it("names the template and counts the lines", () => {
    const notice = savedTemplateNotice(
      savedTemplateState(EMPTY_TEMPLATE_FIELDS, {
        id: "tpl_1",
        name: "Website build",
        lineCount: 4,
      }),
    );

    expect(notice).toBe(
      "Saved “Website build” as a template, with 4 deliverables on it.",
    );
  });

  it("agrees the noun with a template of one line", () => {
    const notice = savedTemplateNotice(
      savedTemplateState(EMPTY_TEMPLATE_FIELDS, {
        id: "tpl_1",
        name: "Retainer month",
        lineCount: 1,
      }),
    );

    expect(notice).toBe(
      "Saved “Retainer month” as a template, with one deliverable on it.",
    );
  });

  it("has nothing to say before anything is saved", () => {
    expect(savedTemplateNotice(initialSaveTemplateState("Rebuild"))).toBeNull();
  });
});
