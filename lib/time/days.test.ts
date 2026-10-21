import { describe, expect, it } from "vitest";

import { billableMinutes, totalMinutes, type LoggedEntry } from "./days";

function entry(fields: Partial<LoggedEntry> = {}): LoggedEntry {
  return {
    id: "tme_1",
    minutes: 30,
    workedOn: "2026-10-17",
    billable: true,
    ...fields,
  };
}

describe("what a set of entries comes to", () => {
  it("adds the minutes up", () => {
    expect(totalMinutes([entry({ minutes: 90 }), entry({ minutes: 45 })])).toBe(
      135,
    );
  });

  it("comes to nothing for no entries at all", () => {
    expect(totalMinutes([])).toBe(0);
  });

  it("stays exact over a long run of thirds of an hour", () => {
    // The reason time is minutes: forty of these is 800 and not 799.992.
    const entries = Array.from({ length: 40 }, () => entry({ minutes: 20 }));
    expect(totalMinutes(entries)).toBe(800);
  });
});

describe("how much of a set is chargeable", () => {
  it("leaves the unticked entries out", () => {
    const entries = [
      entry({ minutes: 90 }),
      entry({ minutes: 60, billable: false }),
    ];
    expect(billableMinutes(entries)).toBe(90);
  });

  it("matches the total when every entry is chargeable", () => {
    const entries = [entry({ minutes: 90 }), entry({ minutes: 60 })];
    expect(billableMinutes(entries)).toBe(totalMinutes(entries));
  });

  it("comes to nothing when none of it is chargeable", () => {
    expect(billableMinutes([entry({ billable: false })])).toBe(0);
  });

  it("counts an unreadable flag as not chargeable", () => {
    // The column is an integer, so a hand-edited row can hold something that
    // is neither true nor false. Charging for it is the expensive mistake.
    const odd = { ...entry(), billable: 2 as unknown as boolean };
    expect(billableMinutes([odd])).toBe(0);
  });
});
