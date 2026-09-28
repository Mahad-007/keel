import { describe, expect, it } from "vitest";

import {
  EMPTY_PROJECT_FIELDS,
  INITIAL_PROJECT_FORM_STATE,
  PROJECT_FIELD_NAMES,
  readProjectFields,
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
