import { describe, expect, it } from "vitest";

import { isBilled } from "./billing";

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
