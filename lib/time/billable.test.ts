import { describe, expect, it } from "vitest";

import {
  ALL_TIME,
  BILLABLE_FILTERS,
  CHARGEABLE_TIME,
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
    expect(parseBillableFilter("nonsense")).toBe(ALL_TIME);
    expect(parseBillableFilter(undefined)).toBe(ALL_TIME);
  });
});
