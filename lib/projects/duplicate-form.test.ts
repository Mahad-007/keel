import { describe, expect, it } from "vitest";

import { PROJECT_FIELD_LIMITS } from "./form";
import {
  initialDuplicateState,
  suggestedDuplicateName,
} from "./duplicate-form";

describe("suggestedDuplicateName", () => {
  it("marks the source project's name as a copy", () => {
    expect(suggestedDuplicateName("Harbour Co — site rebuild")).toBe(
      "Harbour Co — site rebuild (copy)",
    );
  });

  it("trims the name it was handed", () => {
    expect(suggestedDuplicateName("  Retainer  ")).toBe("Retainer (copy)");
  });

  it("marks a copy of a copy, rather than noticing it is one", () => {
    expect(suggestedDuplicateName("Retainer (copy)")).toBe(
      "Retainer (copy) (copy)",
    );
  });

  it("keeps the suffix when the name has to be cut to fit", () => {
    const long = "x".repeat(PROJECT_FIELD_LIMITS.name);

    const suggested = suggestedDuplicateName(long);

    expect(suggested).toHaveLength(PROJECT_FIELD_LIMITS.name);
    expect(suggested.endsWith("(copy)")).toBe(true);
  });

  it("never suggests a name the form would reject", () => {
    for (const name of ["Short", "y".repeat(500)]) {
      expect(suggestedDuplicateName(name).length).toBeLessThanOrEqual(
        PROJECT_FIELD_LIMITS.name,
      );
    }
  });

  it("leaves no space stranded where the name was cut", () => {
    const cut = `${"z".repeat(PROJECT_FIELD_LIMITS.name - 8)} tail`;

    expect(suggestedDuplicateName(cut)).not.toContain("  (copy)");
  });
});

describe("initialDuplicateState", () => {
  it("opens with the suggested name in the box", () => {
    expect(initialDuplicateState("Retainer").fields.name).toBe(
      "Retainer (copy)",
    );
  });

  it("opens with nothing wrong yet", () => {
    const state = initialDuplicateState("Retainer");

    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });
});
