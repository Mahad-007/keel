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

  it("tells the same field in two forms apart", () => {
    expect(fieldId("title", "dlv_wire")).not.toBe(fieldId("title"));
    expect(fieldId("title", "dlv_wire")).not.toBe(
      fieldId("title", "dlv_flows"),
    );
  });

  it("keeps a scoped field's parts under its own control", () => {
    expect(fieldHintId("estimate", "dlv_wire")).toContain(
      fieldId("estimate", "dlv_wire"),
    );
    expect(fieldErrorId("estimate", "dlv_wire")).toContain(
      fieldId("estimate", "dlv_wire"),
    );
  });

  it("does not let a scoped field collide with an unscoped one", () => {
    // The add line at the bottom of a scope list renders the unscoped ids while
    // a row above it renders scoped ones, in the same document.
    expect(fieldErrorId("title", "dlv_wire")).not.toBe(fieldErrorId("title"));
  });

  it("does not run one field's parts into a longer field's", () => {
    expect(fieldHintId("email")).not.toBe(fieldHintId("emailAddress"));
    expect(fieldErrorId("name")).not.toBe(fieldErrorId("nameOfCompany"));
  });
});
