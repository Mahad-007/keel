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
    expect(description.hintId).toBeUndefined();
    expect(description.errorId).toBeUndefined();
  });

  it("leaves a field with no error valid", () => {
    expect(describeField({ name: "name", hint: "Required." }).invalid).toBe(
      false,
    );
  });
});

describe("describeField with an error", () => {
  it("marks the control invalid", () => {
    expect(describeField({ name: "email", error: "Bad." }).invalid).toBe(true);
  });

  it("points the control at the message", () => {
    const description = describeField({ name: "email", error: "Bad." });

    expect(description.errorId).toBe(fieldErrorId("email"));
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
