import { describe, expect, it } from "vitest";

import { readField, readFields } from "./form-data";

describe("readField", () => {
  it("reads a submitted value", () => {
    const form = new FormData();
    form.set("name", "Ada");

    expect(readField(form, "name")).toBe("Ada");
  });

  it("reads a field the browser never sent as empty", () => {
    expect(readField(new FormData(), "name")).toBe("");
  });

  it("reads a file posted to a text field as empty", () => {
    const form = new FormData();
    form.set("notes", new File(["payload"], "notes.txt"));

    expect(readField(form, "notes")).toBe("");
  });

  it("normalizes the line endings a textarea submits", () => {
    const form = new FormData();
    form.set("notes", "first\r\nsecond\rthird\nfourth");

    expect(readField(form, "notes")).toBe("first\nsecond\nthird\nfourth");
  });

  it("does not trim — that is the validator's decision", () => {
    const form = new FormData();
    form.set("name", "  Ada  ");

    expect(readField(form, "name")).toBe("  Ada  ");
  });

  it("takes the first of a repeated field", () => {
    const form = new FormData();
    form.append("name", "Ada");
    form.append("name", "Grace");

    expect(readField(form, "name")).toBe("Ada");
  });
});

describe("readFields", () => {
  it("reads every named field, present or not", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("company", "Analytical Engines");

    expect(readFields(form, ["name", "company", "email"])).toEqual({
      name: "Ada",
      company: "Analytical Engines",
      email: "",
    });
  });

  it("ignores fields nobody asked for", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("isAdmin", "true");

    expect(readFields(form, ["name"])).toEqual({ name: "Ada" });
  });
});
