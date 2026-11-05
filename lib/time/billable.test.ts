import { describe, expect, it } from "vitest";

import {
  ANY_BILLING,
  BILLABLE_FILTERS,
  billableFilterLabel,
  CHARGEABLE_TIME,
  filteredBillable,
  FREE_TIME,
  isBillableFilter,
  parseBillableFilter,
} from "./billable";

describe("isBillableFilter", () => {
  it("accepts every option in the list", () => {
    for (const filter of BILLABLE_FILTERS) {
      expect(isBillableFilter(filter)).toBe(true);
    }
  });

  it("rejects a word that is not one of them", () => {
    expect(isBillableFilter("billable")).toBe(false);
    expect(isBillableFilter("")).toBe(false);
  });

  it("rejects values that are not strings", () => {
    expect(isBillableFilter(undefined)).toBe(false);
    expect(isBillableFilter(true)).toBe(false);
    expect(isBillableFilter(["all"])).toBe(false);
  });
});

describe("parseBillableFilter", () => {
  it("keeps a recognised option", () => {
    expect(parseBillableFilter(CHARGEABLE_TIME)).toBe(CHARGEABLE_TIME);
    expect(parseBillableFilter(FREE_TIME)).toBe(FREE_TIME);
  });

  it("falls back to showing everything", () => {
    expect(parseBillableFilter("nonsense")).toBe(ANY_BILLING);
    expect(parseBillableFilter(undefined)).toBe(ANY_BILLING);
  });
});

describe("filteredBillable", () => {
  it("restricts to chargeable time", () => {
    expect(filteredBillable(CHARGEABLE_TIME)).toBe(true);
  });

  it("restricts to time that will not be charged for", () => {
    expect(filteredBillable(FREE_TIME)).toBe(false);
  });

  it("asks for no restriction at all when nothing is filtered", () => {
    expect(filteredBillable(ANY_BILLING)).toBeUndefined();
  });
});

describe("billableFilterLabel", () => {
  it("names the two halves the way the row is marked", () => {
    expect(billableFilterLabel(CHARGEABLE_TIME)).toBe("Chargeable");
    expect(billableFilterLabel(FREE_TIME)).toBe("Not chargeable");
  });

  it("says all of what the unfiltered tab shows", () => {
    expect(billableFilterLabel(ANY_BILLING)).toBe("Everything");
  });

  it("names every option, with no two sharing a word", () => {
    const labels = BILLABLE_FILTERS.map(billableFilterLabel);
    expect(new Set(labels).size).toBe(BILLABLE_FILTERS.length);
  });
});
