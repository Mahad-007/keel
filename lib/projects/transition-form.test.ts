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

describe("parseTransitionForm on a rejected submission", () => {
  it("rejects a form submitted with no button pressed", () => {
    const parsed = parseTransitionForm(EMPTY_TRANSITION_FIELDS, "active");

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.errors.status).toMatch(/required/);
  });

  it("blames the buttons for a move the project cannot make", () => {
    const parsed = parseTransitionForm(fields({ status: "draft" }), "active");

    expect(!parsed.ok && parsed.errors.status).toMatch(/Reload/);
  });

  it("blames the buttons for a move out of a status the project has left", () => {
    const parsed = parseTransitionForm(fields({ status: "paused" }), "closed");

    expect(!parsed.ok && parsed.errors.status).toMatch(/Reload/);
  });

  it("blames the reason box when a reopening says nothing", () => {
    const parsed = parseTransitionForm(fields({ status: "active" }), "closed");

    expect(!parsed.ok && parsed.errors.reason).toMatch(/Say why/);
    expect(!parsed.ok && parsed.errors.status).toBeUndefined();
  });

  it("blames the reason box when a reopening says only whitespace", () => {
    const parsed = parseTransitionForm(
      fields({ status: "active", reason: "   " }),
      "closed",
    );

    expect(!parsed.ok && parsed.errors.reason).toMatch(/Say why/);
  });

  it("rejects a note past the length limit", () => {
    const parsed = parseTransitionForm(
      fields({
        status: "paused",
        reason: "x".repeat(TRANSITION_REASON_LIMIT + 1),
      }),
      "active",
    );

    expect(!parsed.ok && parsed.errors.reason).toMatch(/characters or fewer/);
  });

  it("accepts a note at the length limit", () => {
    const parsed = parseTransitionForm(
      fields({ status: "paused", reason: "x".repeat(TRANSITION_REASON_LIMIT) }),
      "active",
    );

    expect(parsed.ok).toBe(true);
  });

  it("reports the stale buttons and the bad note together", () => {
    const parsed = parseTransitionForm(
      fields({
        status: "draft",
        reason: "x".repeat(TRANSITION_REASON_LIMIT + 1),
      }),
      "active",
    );

    expect(!parsed.ok && parsed.errors.status).toBeDefined();
    expect(!parsed.ok && parsed.errors.reason).toBeDefined();
  });
});
