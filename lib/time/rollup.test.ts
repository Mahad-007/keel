import { describe, expect, it } from "vitest";

import { loggedTotals, type AttributedEntry } from "./rollup";

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
