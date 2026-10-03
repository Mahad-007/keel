import { describe, expect, it } from "vitest";

import {
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
