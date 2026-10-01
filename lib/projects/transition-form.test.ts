import { describe, expect, it } from "vitest";

import {
  EMPTY_TRANSITION_FIELDS,
  parseTransitionForm,
  readTransitionFields,
  type TransitionFormFields,
} from "./transition-form";
import { TRANSITION_REASON_LIMIT } from "./transitions";

function fields(patch: Partial<TransitionFormFields>): TransitionFormFields {
  return { ...EMPTY_TRANSITION_FIELDS, ...patch };
}

describe("readTransitionFields", () => {
  it("reads the pressed button's status and the note beside it", () => {
    const data = new FormData();
    data.set("status", "paused");
    data.set("reason", "Waiting on their copy.");

    expect(readTransitionFields(data)).toEqual({
      status: "paused",
      reason: "Waiting on their copy.",
    });
  });

  it("reads a form submitted with no button pressed as blank", () => {
    expect(readTransitionFields(new FormData())).toEqual(
      EMPTY_TRANSITION_FIELDS,
    );
  });

  it("normalises the line endings a textarea submits", () => {
    const data = new FormData();
    data.set("reason", "One.\r\nTwo.");

    expect(readTransitionFields(data).reason).toBe("One.\nTwo.");
  });
});

describe("parseTransitionForm on a good submission", () => {
  it("accepts a move the project can make", () => {
    const parsed = parseTransitionForm(fields({ status: "paused" }), "active");

    expect(parsed).toEqual({
      ok: true,
      value: { status: "paused", reason: null },
    });
  });

  it("keeps a note, trimmed", () => {
    const parsed = parseTransitionForm(
      fields({ status: "paused", reason: "  Waiting on copy.  " }),
      "active",
    );

    expect(parsed.ok && parsed.value.reason).toBe("Waiting on copy.");
  });

  it("accepts a reopening that says why", () => {
    const parsed = parseTransitionForm(
      fields({ status: "active", reason: "Phase two." }),
      "closed",
    );

    expect(parsed.ok).toBe(true);
  });
});
