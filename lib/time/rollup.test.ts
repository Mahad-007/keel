import { describe, expect, it } from "vitest";

import {
  loggedTotals,
  varianceMinutes,
  type AttributedEntry,
} from "./rollup";

function entry(fields: Partial<AttributedEntry> = {}): AttributedEntry {
  return {
    id: "tme_1",
    minutes: 30,
    workedOn: "2026-10-17",
    billable: true,
    deliverableId: null,
    ...fields,
  };
}

describe("what a set of entries comes to", () => {
  it("counts the entries and adds up their minutes", () => {
    const totals = loggedTotals([
      entry({ minutes: 90 }),
      entry({ minutes: 45 }),
    ]);
    expect(totals.entryCount).toBe(2);
    expect(totals.loggedMinutes).toBe(135);
  });

  it("comes to three zeroes for a line nobody has logged against", () => {
    expect(loggedTotals([])).toEqual({
      entryCount: 0,
      loggedMinutes: 0,
      billableMinutes: 0,
    });
  });

  it("leaves the unticked entries out of the chargeable figure only", () => {
    const totals = loggedTotals([
      entry({ minutes: 90 }),
      entry({ minutes: 60, billable: false }),
    ]);
    expect(totals.loggedMinutes).toBe(150);
    expect(totals.billableMinutes).toBe(90);
  });

  it("counts a flag that is neither true nor false as not chargeable", () => {
    // The column is an integer, so a hand-edited row can hold a 2. The whole
    // 30 minutes happened; none of it is charged for.
    const odd = { ...entry(), billable: 2 as unknown as boolean };
    const totals = loggedTotals([odd]);
    expect(totals.loggedMinutes).toBe(30);
    expect(totals.billableMinutes).toBe(0);
  });
});

describe("how far logged time has run past its estimate", () => {
  it("reports time over the estimate as a positive figure", () => {
    expect(varianceMinutes(360, 240)).toBe(120);
  });

  it("reports time short of the estimate as a negative one", () => {
    expect(varianceMinutes(180, 240)).toBe(-60);
  });

  it("reports a line logged to its estimate exactly as nought", () => {
    expect(varianceMinutes(240, 240)).toBe(0);
  });

  it("reports an estimated line nobody has logged against as under by all of it", () => {
    expect(varianceMinutes(0, 240)).toBe(-240);
  });

  it("refuses to compare a line nobody estimated", () => {
    // Not nought: six hours against no estimate is not six hours over.
    expect(varianceMinutes(360, 0)).toBeNull();
  });

  it("refuses to compare an unestimated line with nothing logged either", () => {
    expect(varianceMinutes(0, 0)).toBeNull();
  });

  it("compares a negative estimate rather than dropping the line", () => {
    // Only a hand-edited row gets here. The figure is odd and visible, which
    // is the point — a line missing from the column is harder to find.
    expect(varianceMinutes(60, -120)).toBe(180);
  });
});
