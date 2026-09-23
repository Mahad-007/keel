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
