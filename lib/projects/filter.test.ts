import { describe, expect, it } from "vitest";

import {
  ALL_STATUSES,
  PROJECT_STATUS_FILTERS,
  filteredStatus,
  isProjectStatusFilter,
  parseProjectStatusFilter,
} from "./filter";
import { PROJECT_STATUSES } from "./status";

describe("PROJECT_STATUS_FILTERS", () => {
  it("offers every status plus the unfiltered option, and nothing else", () => {
    expect(PROJECT_STATUS_FILTERS).toEqual([ALL_STATUSES, ...PROJECT_STATUSES]);
  });

  it("puts the unfiltered option first, where the list lands by default", () => {
    expect(PROJECT_STATUS_FILTERS[0]).toBe(ALL_STATUSES);
  });
});

describe("isProjectStatusFilter", () => {
  it("accepts every option the filter row renders", () => {
    for (const filter of PROJECT_STATUS_FILTERS) {
      expect(isProjectStatusFilter(filter)).toBe(true);
    }
  });

  it("rejects statuses the projects table does not have", () => {
    expect(isProjectStatusFilter("archived")).toBe(false);
    expect(isProjectStatusFilter("open")).toBe(false);
    expect(isProjectStatusFilter("Active")).toBe(false);
  });
});

describe("parseProjectStatusFilter", () => {
  it("keeps a status it recognises", () => {
    for (const status of PROJECT_STATUSES) {
      expect(parseProjectStatusFilter(status)).toBe(status);
    }
  });

  it("falls back to everything for a param that is absent or junk", () => {
    expect(parseProjectStatusFilter(undefined)).toBe(ALL_STATUSES);
    expect(parseProjectStatusFilter("")).toBe(ALL_STATUSES);
    expect(parseProjectStatusFilter("closd")).toBe(ALL_STATUSES);
    expect(parseProjectStatusFilter(["active"])).toBe(ALL_STATUSES);
  });
});

describe("filteredStatus", () => {
  it("hands each status straight through", () => {
    for (const status of PROJECT_STATUSES) {
      expect(filteredStatus(status)).toBe(status);
    }
  });

  it("turns the unfiltered option into no restriction at all", () => {
    expect(filteredStatus(ALL_STATUSES)).toBeUndefined();
  });
});
