import { describe, expect, it } from "vitest";

import { fieldErrorId, fieldHintId, fieldId } from "./ids";

describe("field ids", () => {
  it("derives the same control id from the same field name", () => {
    expect(fieldId("name")).toBe(fieldId("name"));
  });

  it("gives two fields different ids", () => {
    expect(fieldId("name")).not.toBe(fieldId("company"));
  });

  it("namespaces the hint and error under the control", () => {
    expect(fieldHintId("notes")).toContain(fieldId("notes"));
    expect(fieldErrorId("notes")).toContain(fieldId("notes"));
  });

  it("keeps a field's hint and error ids apart", () => {
    expect(fieldHintId("notes")).not.toBe(fieldErrorId("notes"));
  });

  it("does not run one field's parts into a longer field's", () => {
    expect(fieldHintId("email")).not.toBe(fieldHintId("emailAddress"));
    expect(fieldErrorId("name")).not.toBe(fieldErrorId("nameOfCompany"));
  });
});
