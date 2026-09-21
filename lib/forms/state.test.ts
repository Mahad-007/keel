import { describe, expect, it } from "vitest";

import {
  failedFormState,
  fieldErrorCount,
  firstErrorField,
  formSummary,
  hasErrors,
  initialFormState,
  rejectedFormState,
  type FormState,
} from "./state";

const fields = { name: "Ada", email: "nope" };

describe("initialFormState", () => {
  it("starts clean with the fields it was given", () => {
    const state = initialFormState(fields);

    expect(state).toEqual({ fields, errors: {}, formError: null });
    expect(hasErrors(state)).toBe(false);
    expect(formSummary(state)).toBeNull();
  });
});

describe("rejectedFormState", () => {
  it("echoes what was typed so a rejection does not clear the form", () => {
    const state = rejectedFormState(fields, { email: "Not an address." });

    expect(state.fields).toEqual(fields);
    expect(state.errors).toEqual({ email: "Not an address." });
    expect(state.formError).toBeNull();
    expect(hasErrors(state)).toBe(true);
  });
});

describe("failedFormState", () => {
  it("carries a whole-form problem with no field blamed for it", () => {
    const state = failedFormState(fields, "Could not save the client.");

    expect(state.errors).toEqual({});
    expect(fieldErrorCount(state)).toBe(0);
    expect(hasErrors(state)).toBe(true);
    expect(formSummary(state)).toBe("Could not save the client.");
  });
});

describe("formSummary", () => {
  it("says nothing when nothing is wrong", () => {
    expect(formSummary(initialFormState(fields))).toBeNull();
  });

  it("counts one bad field in the singular", () => {
    const state = rejectedFormState(fields, { name: "Name is required." });

    expect(formSummary(state)).toBe("Nothing was saved. One field needs fixing.");
  });

  it("counts several bad fields", () => {
    const state = rejectedFormState(fields, {
      name: "Name is required.",
      email: "Not an address.",
    });

    expect(formSummary(state)).toBe("Nothing was saved. 2 fields need fixing.");
  });

  it("prefers the form-level problem over the field count", () => {
    const state = {
      fields,
      errors: { name: "Name is required." },
      formError: "Could not save the client.",
    };

    expect(formSummary(state)).toBe("Could not save the client.");
  });
});

describe("firstErrorField", () => {
  const order = ["name", "email"] as const;

  it("returns nothing when the form is clean", () => {
    expect(firstErrorField(initialFormState(fields), order)).toBeNull();
  });

  it("follows the form's order, not the order the errors were keyed", () => {
    const state = rejectedFormState(fields, {
      email: "Not an address.",
      name: "Name is required.",
    });

    expect(firstErrorField(state, order)).toBe("name");
  });

  it("skips fields that are fine", () => {
    const state = rejectedFormState(fields, { email: "Not an address." });

    expect(firstErrorField(state, order)).toBe("email");
  });

  it("ignores an error for a field the form does not render", () => {
    const state: FormState<"name" | "email" | "phone"> = {
      fields: { ...fields, phone: "" },
      errors: { phone: "Nope." },
      formError: null,
    };

    expect(firstErrorField(state, ["name", "email", "phone"])).toBe("phone");
    expect(firstErrorField(state, order)).toBeNull();
  });

  it("returns nothing for a form-level failure, which blames no field", () => {
    const state = failedFormState(fields, "Could not save the client.");

    expect(firstErrorField(state, order)).toBeNull();
  });
});
