import { describe, expect, it } from "vitest";

import { describeField } from "./describe";
import { fieldErrorId, fieldHintId, fieldId } from "./ids";

describe("describeField", () => {
  it("labels the control with the field's id", () => {
    expect(describeField({ name: "name" }).id).toBe(fieldId("name"));
  });

  it("describes nothing on a field with no hint and no error", () => {
    const description = describeField({ name: "name" });

    expect(description.describedBy).toBeUndefined();
    expect(description.hint).toBeNull();
    expect(description.error).toBeNull();
  });

  it("leaves a field with no error valid", () => {
    expect(describeField({ name: "name", hint: "Required." }).invalid).toBe(
      false,
    );
  });

  it("describes a field by its hint when nothing is wrong", () => {
    const description = describeField({ name: "name", hint: "Required." });

    expect(description.hint).toEqual({
      id: fieldHintId("name"),
      text: "Required.",
    });
    expect(description.describedBy).toBe(fieldHintId("name"));
  });
});

describe("describeField with an error", () => {
  it("marks the control invalid", () => {
    expect(describeField({ name: "email", error: "Bad." }).invalid).toBe(true);
  });

  it("points the control at the message", () => {
    const description = describeField({ name: "email", error: "Bad." });

    expect(description.error).toEqual({ id: fieldErrorId("email"), text: "Bad." });
    expect(description.describedBy).toBe(fieldErrorId("email"));
  });

  it("reads the error before the hint", () => {
    const description = describeField({
      name: "email",
      hint: "Optional.",
      error: "Bad.",
    });

    expect(description.describedBy).toBe(
      `${fieldErrorId("email")} ${fieldHintId("email")}`,
    );
  });
});

describe("describeField with a blank message", () => {
  it("leaves a field with an empty error valid", () => {
    const description = describeField({ name: "name", error: "" });

    expect(description.invalid).toBe(false);
    expect(description.error).toBeNull();
  });

  it("ignores a whitespace-only error", () => {
    expect(describeField({ name: "name", error: "   " }).invalid).toBe(false);
  });

  it("hands back the message without its surrounding whitespace", () => {
    expect(describeField({ name: "name", error: "  Required.  " }).error).toEqual(
      { id: fieldErrorId("name"), text: "Required." },
    );
  });

  it("does not describe a field by an empty hint", () => {
    const description = describeField({ name: "name", hint: "" });

    expect(description.hint).toBeNull();
    expect(description.describedBy).toBeUndefined();
  });
});
