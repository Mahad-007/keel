import { describe, expect, it } from "vitest";

import {
  attributionLabel,
  attributionPhrase,
  entryAttribution,
  type ListedTimeEntry,
} from "./entry";

const DELIVERABLES = [
  { id: "dlv_wire", title: "Wireframes" },
  { id: "dlv_build", title: "Build" },
];

function listed(
  fields: Partial<ListedTimeEntry> = {},
): ListedTimeEntry {
  return {
    id: "tme_1",
    minutes: 90,
    note: null,
    workedOn: "2026-10-17",
    deliverableId: null,
    billable: true,
    billedInvoiceId: null,
    ...fields,
  };
}

describe("where an entry went", () => {
  it("names the line it was attributed to", () => {
    const where = entryAttribution(
      listed({ deliverableId: "dlv_wire" }),
      DELIVERABLES,
    );
    expect(where).toEqual({ kind: "deliverable", title: "Wireframes" });
  });

  it("calls an unattributed entry the project's own work", () => {
    // A real answer rather than a missing one: the call, the invoicing, the
    // afternoon of email the scope list has no line for.
    expect(entryAttribution(listed(), DELIVERABLES)).toEqual({
      kind: "project",
    });
  });

  it("does not claim a line it cannot name is no line at all", () => {
    // The titles come from the list the page read. A line dropped since that
    // read is a fact about the page, not about where the hour went.
    expect(
      entryAttribution(listed({ deliverableId: "dlv_gone" }), DELIVERABLES),
    ).toEqual({ kind: "unknown" });
  });

  it("is the project's own work when the project has no scope list", () => {
    expect(entryAttribution(listed(), [])).toEqual({ kind: "project" });
  });
});

describe("what a row says about where the work went", () => {
  it("gives the line its own title, unquoted", () => {
    expect(attributionLabel({ kind: "deliverable", title: "Build" })).toBe(
      "Build",
    );
  });

  it("calls unattributed work the project itself rather than a blank", () => {
    // A blank down the side of a column of durations reads as a list somebody
    // has not finished filling in.
    expect(attributionLabel({ kind: "project" })).toBe("The project itself");
  });

  it("says a line it cannot name is one this page cannot show", () => {
    expect(attributionLabel({ kind: "unknown" })).toMatch(/cannot show/);
  });
});

describe("where the work went, inside a sentence", () => {
  it("quotes the title so it does not run into the next clause", () => {
    expect(attributionPhrase({ kind: "deliverable", title: "Build" })).toBe(
      "“Build”",
    );
  });

  it("reads as a clause rather than as a heading", () => {
    expect(attributionPhrase({ kind: "project" })).toBe("the project itself");
    expect(attributionPhrase({ kind: "unknown" })).toBe(
      "a deliverable this page cannot show",
    );
  });
});
