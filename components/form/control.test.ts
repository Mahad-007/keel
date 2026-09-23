import { describe, expect, it } from "vitest";

import { controlAttributes, controlClassName } from "./control";
import { describeField } from "./describe";
import { fieldErrorId, fieldId } from "./ids";

describe("controlClassName", () => {
  it("gives a valid and an invalid control the same box", () => {
    const shared = controlClassName(false)
      .split(" ")
      .filter((name) => controlClassName(true).split(" ").includes(name));

    expect(shared).toContain("rounded");
    expect(shared).toContain("px-2.5");
    expect(shared).toContain("text-sm");
  });

  it("marks an invalid control out from a valid one", () => {
    expect(controlClassName(true)).not.toBe(controlClassName(false));
  });

  it("does not leave a valid control wearing the invalid border", () => {
    expect(controlClassName(false)).not.toMatch(/border-red/);
    expect(controlClassName(true)).toMatch(/border-red/);
  });
});

describe("controlAttributes", () => {
  it("labels the control with the id its label points at", () => {
    expect(controlAttributes(describeField({ name: "name" })).id).toBe(
      fieldId("name"),
    );
  });

  it("leaves aria-invalid off a field with nothing wrong", () => {
    const attributes = controlAttributes(describeField({ name: "name" }));

    expect(attributes["aria-invalid"]).toBeUndefined();
    expect(attributes["aria-describedby"]).toBeUndefined();
  });

  it("marks a rejected field invalid and points it at the message", () => {
    const attributes = controlAttributes(
      describeField({ name: "name", error: "Name is required." }),
    );

    expect(attributes["aria-invalid"]).toBe(true);
    expect(attributes["aria-describedby"]).toBe(fieldErrorId("name"));
  });

  it("carries the invalid styling as well as the invalid attribute", () => {
    const attributes = controlAttributes(
      describeField({ name: "name", error: "Name is required." }),
    );

    expect(attributes.className).toBe(controlClassName(true));
  });
});
