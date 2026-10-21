import { describe, expect, it } from "vitest";

import {
  BILLED_COLUMNS,
  billedColumnsIn,
  editRefusedByInvoice,
  isBilled,
  isChargeable,
} from "./billing";

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

describe("editRefusedByInvoice", () => {
  const billed = { billedInvoiceId: "inv_0001" };
  const unbilled = { billedInvoiceId: null };

  it("refuses a billed entry's minutes", () => {
    expect(editRefusedByInvoice(billed, { minutes: 120 })).toBe(true);
  });

  it("refuses a billed entry being marked non-billable", () => {
    expect(editRefusedByInvoice(billed, { billable: false })).toBe(true);
  });

  it("refuses a billed entry being re-dated", () => {
    expect(editRefusedByInvoice(billed, { workedOn: "2026-10-01" })).toBe(true);
  });

  it("refuses a billed entry being re-attributed", () => {
    expect(editRefusedByInvoice(billed, { deliverableId: "dlv_two" })).toBe(
      true,
    );
  });

  it("allows a billed entry's note to be corrected", () => {
    expect(editRefusedByInvoice(billed, { note: "Reworded" } as never)).toBe(
      false,
    );
  });

  it("allows an empty patch against a billed entry", () => {
    expect(editRefusedByInvoice(billed, {})).toBe(false);
  });

  it("allows every column while the entry is unbilled", () => {
    for (const column of BILLED_COLUMNS) {
      expect(editRefusedByInvoice(unbilled, { [column]: 1 })).toBe(false);
    }
  });

  it("refuses a value the row may already hold rather than comparing", () => {
    expect(editRefusedByInvoice(billed, { minutes: 90 })).toBe(true);
  });
});

describe("whether time is meant to be charged for", () => {
  it("reads a ticked flag as chargeable", () => {
    expect(isChargeable({ billable: true })).toBe(true);
  });

  it("reads an unticked flag as not chargeable", () => {
    expect(isChargeable({ billable: false })).toBe(false);
  });

  it("reads anything that is not exactly true as not chargeable", () => {
    // The column is an integer, so a hand-written row can hold a 2. Charging
    // for it is the expensive direction to be wrong in.
    expect(isChargeable({ billable: 2 as unknown as boolean })).toBe(false);
    expect(isChargeable({ billable: null as unknown as boolean })).toBe(false);
  });
});
