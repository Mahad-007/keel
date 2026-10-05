import { describe, expect, it } from "vitest";

import {
  ADD_NO_ANSWER,
  DELIVERABLE_FIELD_LIMITS,
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
