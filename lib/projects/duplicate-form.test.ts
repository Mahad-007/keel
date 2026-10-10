import { describe, expect, it } from "vitest";

import { PROJECT_FIELD_LIMITS } from "./form";
import {
  initialDuplicateState,
  parseDuplicateForm,
  readDuplicateFields,
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

describe("parseDuplicateForm", () => {
  it("accepts a name and hands it back trimmed", () => {
    const parsed = parseDuplicateForm({ name: "  Phase two  " });

    expect(parsed.ok && parsed.value).toEqual({ name: "Phase two" });
  });

  it("refuses a copy with no name", () => {
    const parsed = parseDuplicateForm({ name: "" });

    expect(!parsed.ok && parsed.errors.name).toBe("Name is required.");
  });

  it("refuses a name of nothing but spaces", () => {
    const parsed = parseDuplicateForm({ name: "   " });

    expect(parsed.ok).toBe(false);
  });

  it("refuses a name longer than the column holds", () => {
    const parsed = parseDuplicateForm({
      name: "x".repeat(PROJECT_FIELD_LIMITS.name + 1),
    });

    expect(!parsed.ok && parsed.errors.name).toContain(
      `${PROJECT_FIELD_LIMITS.name} characters`,
    );
  });

  it("accepts a name of exactly the length allowed", () => {
    const parsed = parseDuplicateForm({
      name: "x".repeat(PROJECT_FIELD_LIMITS.name),
    });

    expect(parsed.ok).toBe(true);
  });

  it("accepts the name the form suggested, whatever its length", () => {
    const parsed = parseDuplicateForm({
      name: suggestedDuplicateName("y".repeat(400)),
    });

    expect(parsed.ok).toBe(true);
  });
});

describe("readDuplicateFields", () => {
  it("reads the name off the submission", () => {
    const form = new FormData();
    form.set("name", "Phase two");

    expect(readDuplicateFields(form)).toEqual({ name: "Phase two" });
  });

  it("reads a missing field as blank rather than undefined", () => {
    expect(readDuplicateFields(new FormData())).toEqual({ name: "" });
  });
});
