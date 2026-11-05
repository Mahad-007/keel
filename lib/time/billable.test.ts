import { describe, expect, it } from "vitest";

import {
  ANY_BILLING,
  BILLABLE_FILTERS,
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
