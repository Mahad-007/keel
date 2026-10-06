import { describe, expect, it } from "vitest";

import type { Deliverable } from "@/lib/db/schema";

import { firstErrorField } from "@/lib/forms/state";

import {
  ADD_NO_ANSWER,
  DELIVERABLE_FIELD_NAMES,
  DELIVERABLE_FIELD_LIMITS,
  deliverableFormFields,
  EMPTY_DELIVERABLE_FIELDS,
  parseDeliverableForm,
  type DeliverableFormFields,
} from "./form";

function submitted(
  values: Partial<DeliverableFormFields> = {},
): DeliverableFormFields {
  return { ...EMPTY_DELIVERABLE_FIELDS, ...values };
}

describe("the title of a deliverable", () => {
  it("is trimmed and kept", () => {
    const parsed = parseDeliverableForm(submitted({ title: "  Wireframes " }));
    expect(parsed).toMatchObject({ ok: true, value: { title: "Wireframes" } });
  });

  it("is required, because a line with no title says nothing", () => {
    const parsed = parseDeliverableForm(submitted({ title: "" }));
    expect(parsed).toEqual({
      ok: false,
      errors: { title: "Title is required." },
    });
  });

  it("counts a title of only whitespace as missing", () => {
    const parsed = parseDeliverableForm(submitted({ title: "   " }));
    expect(parsed).toMatchObject({ ok: false });
  });

  it("stops at the length the input stops at", () => {
    const title = "x".repeat(DELIVERABLE_FIELD_LIMITS.title + 1);
    expect(parseDeliverableForm(submitted({ title }))).toEqual({
      ok: false,
      errors: { title: "Title must be 120 characters or fewer." },
    });
  });
});

describe("the description under a title", () => {
  it("is kept when there is one", () => {
    const parsed = parseDeliverableForm(
      submitted({ title: "Wireframes", description: "  Six screens.  " }),
    );
    expect(parsed).toMatchObject({ value: { description: "Six screens." } });
  });

  it("is null when blank, so the column stores absence and not an empty string", () => {
    const parsed = parseDeliverableForm(submitted({ title: "Wireframes" }));
    expect(parsed).toMatchObject({ value: { description: null } });
  });

  it("refuses a brief pasted into it", () => {
    const description = "x".repeat(
      DELIVERABLE_FIELD_LIMITS.description + 1,
    );
    expect(
      parseDeliverableForm(submitted({ title: "Wireframes", description })),
    ).toEqual({
      ok: false,
      errors: { description: "Description must be 2000 characters or fewer." },
    });
  });
});

describe("the estimate beside a deliverable", () => {
  it("arrives as the whole minutes the column stores", () => {
    const parsed = parseDeliverableForm(
      submitted({ title: "Wireframes", estimate: "1.5" }),
    );
    expect(parsed).toMatchObject({ value: { estimatedMinutes: 90 } });
  });

  it("is zero when left alone, which reads as not estimated yet", () => {
    const parsed = parseDeliverableForm(submitted({ title: "Wireframes" }));
    expect(parsed).toMatchObject({ value: { estimatedMinutes: 0 } });
  });

  it("is reported under its own field so the message lands on the box", () => {
    expect(
      parseDeliverableForm(submitted({ title: "Wireframes", estimate: "a bit" })),
    ).toEqual({
      ok: false,
      errors: { estimate: "Estimate must be a number of hours, like 2 or 1.5." },
    });
  });
});

describe("a deliverable wrong in several ways", () => {
  it("comes back with every message at once, not the first one", () => {
    const parsed = parseDeliverableForm(
      submitted({ title: "", estimate: "-1" }),
    );
    expect(parsed).toEqual({
      ok: false,
      errors: {
        title: "Title is required.",
        estimate: "Estimate cannot be negative.",
      },
    });
  });
});

describe("the sentence an add with no answer comes back with", () => {
  it("does not claim the deliverable was not written, because it cannot know", () => {
    expect(ADD_NO_ANSWER).not.toMatch(/[Nn]othing was (changed|written|added)/);
  });

  it("does not invite the add to be made again, which would write it twice", () => {
    expect(ADD_NO_ANSWER).not.toMatch(/try again/);
  });

  it("sends the reader to the list, which is what the server says", () => {
    expect(ADD_NO_ANSWER).toMatch(/Reload/);
  });
});

function stored(values: Partial<Deliverable> = {}): Deliverable {
  return {
    id: "dlv_wire",
    projectId: "prj_engine",
    title: "Wireframes",
    description: "Six screens.",
    estimatedMinutes: 90,
    status: "pending",
    sortOrder: 0,
    createdAt: "2026-10-03T09:00:00.000Z",
    updatedAt: "2026-10-03T09:00:00.000Z",
    ...values,
  };
}

describe("a stored deliverable as form fields", () => {
  it("offers the title, the detail and the estimate in hours", () => {
    expect(deliverableFormFields(stored())).toEqual({
      title: "Wireframes",
      description: "Six screens.",
      estimate: "1.5",
    });
  });

  it("shows a missing description as an empty box", () => {
    expect(deliverableFormFields(stored({ description: null }))).toMatchObject({
      description: "",
    });
  });

  it("shows an unestimated line as an empty box, not a zero", () => {
    expect(
      deliverableFormFields(stored({ estimatedMinutes: 0 })),
    ).toMatchObject({ estimate: "" });
  });

  it("parses back to exactly what was stored, so an untouched save is a no-op", () => {
    const deliverable = stored({ description: null, estimatedMinutes: 0 });
    expect(parseDeliverableForm(deliverableFormFields(deliverable))).toEqual({
      ok: true,
      value: { title: "Wireframes", description: null, estimatedMinutes: 0 },
    });
  });

  it("keeps a title that is all the form will allow", () => {
    const title = "x".repeat(DELIVERABLE_FIELD_LIMITS.title);
    expect(parseDeliverableForm(deliverableFormFields(stored({ title })))).toMatchObject({
      ok: true,
      value: { title },
    });
  });
});

describe("the order the deliverable fields are walked in", () => {
  it("is the order they are laid out: title, estimate, then detail", () => {
    expect(DELIVERABLE_FIELD_NAMES).toEqual(["title", "estimate", "description"]);
  });

  it("puts the cursor in the estimate, not the detail box below it", () => {
    // The estimate sits beside the title and the detail underneath both, so a
    // submission wrong in the estimate and the detail has to stop at the
    // estimate on the way down.
    const state = {
      fields: EMPTY_DELIVERABLE_FIELDS,
      errors: {
        description: "Description is too long.",
        estimate: "Estimate must be a number of hours, like 2 or 1.5.",
      },
      formError: null,
    };

    expect(firstErrorField(state, DELIVERABLE_FIELD_NAMES)).toBe("estimate");
  });
});
