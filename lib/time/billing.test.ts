import { describe, expect, it } from "vitest";

import { BILLED_COLUMNS, billedColumnsIn, isBilled } from "./billing";

describe("isBilled", () => {
  it("reads an entry with no invoice as unbilled", () => {
    expect(isBilled({ billedInvoiceId: null })).toBe(false);
  });

  it("reads an entry naming an invoice as billed", () => {
    expect(isBilled({ billedInvoiceId: "inv_0001" })).toBe(true);
  });

  it("reads a blank invoice id as billed, like the write does", () => {
    // The write that marks an entry billed requires the column to be NULL, so
    // a row holding an empty string cannot be billed again either way.
    expect(isBilled({ billedInvoiceId: "" })).toBe(true);
  });
});

describe("billedColumnsIn", () => {
  it("finds nothing in an empty patch", () => {
    expect(billedColumnsIn({})).toEqual([]);
  });

  it("names the one column a patch moves", () => {
    expect(billedColumnsIn({ minutes: 90 })).toEqual(["minutes"]);
  });

  it("names every billed column a patch moves, in declared order", () => {
    expect(
      billedColumnsIn({ billable: false, workedOn: "2026-10-16" }),
    ).toEqual(["workedOn", "billable"]);
  });

  it("counts an attribution cleared to null as a move", () => {
    expect(billedColumnsIn({ deliverableId: null })).toEqual(["deliverableId"]);
  });

  it("counts a column set to false as a move", () => {
    // `billable: false` is the whole reason this is an undefined check rather
    // than a truthiness one.
    expect(billedColumnsIn({ billable: false })).toEqual(["billable"]);
  });

  it("reads an explicitly undefined column as not moved", () => {
    expect(billedColumnsIn({ minutes: undefined })).toEqual([]);
  });

  it("ignores columns no invoice reads", () => {
    expect(billedColumnsIn({ note: "Reworded" } as never)).toEqual([]);
  });

  it("leaves the note off the frozen list", () => {
    expect(BILLED_COLUMNS).not.toContain("note");
  });
});
