import { describe, expect, it } from "vitest";

import {
  attributionLabel,
  attributionPhrase,
  canChangeEntry,
  entryAttribution,
  entryMarks,
  entryName,
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

describe("the marks on an entry", () => {
  it("leaves the ordinary entry unmarked", () => {
    // Chargeable and unbilled is what every entry is. A mark on all of them is
    // a mark that says nothing.
    expect(entryMarks(listed())).toEqual([]);
  });

  it("marks time nobody is going to be charged for", () => {
    expect(entryMarks(listed({ billable: false }))).toEqual([
      "Not chargeable",
    ]);
  });

  it("marks time an invoice has already taken", () => {
    expect(entryMarks(listed({ billedInvoiceId: "inv_7" }))).toEqual([
      "Billed",
    ]);
  });

  it("shows both marks on a row that contradicts itself", () => {
    // Nothing in this app can write it, which is exactly why it is worth
    // showing rather than simplifying away.
    expect(
      entryMarks(listed({ billable: false, billedInvoiceId: "inv_7" })),
    ).toEqual(["Not chargeable", "Billed"]);
  });

  it("marks an unreadable chargeable flag as not chargeable", () => {
    const odd = listed({ billable: 2 as unknown as boolean });
    expect(entryMarks(odd)).toEqual(["Not chargeable"]);
  });
});

describe("whether an entry can still be changed", () => {
  it("lets an unbilled entry be edited and deleted", () => {
    expect(canChangeEntry(listed())).toBe(true);
  });

  it("refuses a billed entry outright", () => {
    expect(canChangeEntry(listed({ billedInvoiceId: "inv_7" }))).toBe(false);
  });

  it("refuses one billed by an invoice with a blank id", () => {
    // The write that bills matches on IS NULL, so a blank is already a row
    // that cannot be billed again. Reading it as editable would let the two
    // rules disagree about the same row.
    expect(canChangeEntry(listed({ billedInvoiceId: "" }))).toBe(false);
  });

  it("does not care whether the time was chargeable", () => {
    expect(canChangeEntry(listed({ billable: false }))).toBe(true);
  });
});

describe("naming one entry well enough to act on it", () => {
  const where = { kind: "deliverable", title: "Wireframes" } as const;

  it("leads with what the entry is: how long, and which day", () => {
    expect(entryName(listed(), { kind: "project" })).toBe(
      "1h 30m on Oct 17, 2026 against the project itself",
    );
  });

  it("names the line the work went against", () => {
    expect(entryName(listed(), where)).toBe(
      "1h 30m on Oct 17, 2026 against “Wireframes”",
    );
  });

  it("adds the note, which is what tells two identical entries apart", () => {
    expect(entryName(listed({ note: "Paired on the booking flow" }), where)).toBe(
      "1h 30m on Oct 17, 2026 against “Wireframes”, Paired on the booking flow",
    );
  });

  it("ends at the attribution when there is no note", () => {
    expect(entryName(listed({ note: null }), where)).toBe(
      "1h 30m on Oct 17, 2026 against “Wireframes”",
    );
  });

  it("treats a note of whitespace as no note", () => {
    expect(entryName(listed({ note: "   " }), where)).toBe(
      entryName(listed({ note: null }), where),
    );
  });

  it("cuts a long note down rather than reading a paragraph aloud", () => {
    const named = entryName(listed({ note: "x".repeat(200) }), where);
    expect(named).toContain(`${"x".repeat(60)}…`);
    expect(named).not.toContain("x".repeat(61));
  });

  it("tells two entries of the same length on the same day apart", () => {
    const first = listed({ id: "a", note: "Booking flow" });
    const second = listed({ id: "b", note: "Invoice screen" });
    expect(entryName(first, where)).not.toBe(entryName(second, where));
  });
});
