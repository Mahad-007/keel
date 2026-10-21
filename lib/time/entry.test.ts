import { describe, expect, it } from "vitest";

import { entryAttribution, type ListedTimeEntry } from "./entry";

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
