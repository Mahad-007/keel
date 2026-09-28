import { describe, expect, it } from "vitest";

import {
  EMPTY_PROJECT_FIELDS,
  INITIAL_PROJECT_FORM_STATE,
  PROJECT_FIELD_NAMES,
  parseProjectForm,
  readProjectFields,
  type ProjectFormFields,
} from "./form";

function submitted(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

describe("readProjectFields", () => {
  it("reads every field the form declares", () => {
    const fields = readProjectFields(
      submitted({
        client: "cli_ada",
        name: "Engine rewrite",
        contractValue: "12000",
        rateOverride: "180",
      }),
    );

    expect(fields).toEqual({
      client: "cli_ada",
      name: "Engine rewrite",
      contractValue: "12000",
      rateOverride: "180",
    });
  });

  it("reads a field the browser never sent as blank", () => {
    expect(readProjectFields(submitted({ name: "Engine rewrite" }))).toEqual({
      ...EMPTY_PROJECT_FIELDS,
      name: "Engine rewrite",
    });
  });

  it("ignores anything submitted under a name the form does not have", () => {
    const fields = readProjectFields(
      submitted({ name: "Engine rewrite", status: "closed" }),
    );

    expect(Object.keys(fields).sort()).toEqual([...PROJECT_FIELD_NAMES].sort());
  });
});

describe("INITIAL_PROJECT_FORM_STATE", () => {
  it("is a blank form with nothing wrong with it yet", () => {
    expect(INITIAL_PROJECT_FORM_STATE).toEqual({
      fields: EMPTY_PROJECT_FIELDS,
      errors: {},
      formError: null,
    });
  });
});

const CLIENTS = ["cli_ada", "cli_grace"];

function parse(fields: Partial<ProjectFormFields>, clientIds = CLIENTS) {
  return parseProjectForm(
    { ...EMPTY_PROJECT_FIELDS, client: "cli_ada", name: "Engine rewrite", ...fields },
    clientIds,
  );
}

function errors(fields: Partial<ProjectFormFields>, clientIds = CLIENTS) {
  const result = parse(fields, clientIds);
  if (result.ok) throw new Error("expected the form to be rejected");
  return result.errors;
}

describe("the client a project is filed under", () => {
  it("is carried through as the project's client id", () => {
    const result = parse({ client: "cli_grace" });
    expect(result.ok && result.value.clientId).toBe("cli_grace");
  });

  it("must be picked", () => {
    expect(errors({ client: "" }).client).toBe("Client is required.");
  });

  it("must be one the form offered", () => {
    expect(errors({ client: "cli_nobody" }).client).toBe(
      "That client is not one you can pick. Choose another.",
    );
  });
});

describe("a project's name", () => {
  it("comes back trimmed", () => {
    const result = parse({ name: "  Engine rewrite  " });
    expect(result.ok && result.value.name).toBe("Engine rewrite");
  });

  it("is required, and whitespace is not a name", () => {
    expect(errors({ name: "" }).name).toBe("Name is required.");
    expect(errors({ name: "   " }).name).toBe("Name is required.");
  });

  it("stops at the length the input stops at", () => {
    expect(errors({ name: "x".repeat(121) }).name).toBe(
      "Name must be 120 characters or fewer.",
    );
    expect(parse({ name: "x".repeat(120) }).ok).toBe(true);
  });
});
