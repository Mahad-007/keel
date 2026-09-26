import { describe, expect, it } from "vitest";

import {
  ALL_STATUSES,
  PROJECT_STATUS_FILTERS,
  filterCount,
  filteredStatus,
  isProjectStatusFilter,
  parseProjectStatusFilter,
  projectStatusFilterLabel,
} from "./filter";
import { PROJECT_STATUSES, projectStatusLabel } from "./status";

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

describe("projectStatusFilterLabel", () => {
  it("names all of what the unfiltered tab shows", () => {
    expect(projectStatusFilterLabel(ALL_STATUSES)).toBe("All projects");
  });

  it("reuses the status label for the rest", () => {
    for (const status of PROJECT_STATUSES) {
      expect(projectStatusFilterLabel(status)).toBe(projectStatusLabel(status));
    }
  });

  it("labels every tab distinctly, so no two read the same", () => {
    const labels = PROJECT_STATUS_FILTERS.map(projectStatusFilterLabel);
    expect(new Set(labels).size).toBe(PROJECT_STATUS_FILTERS.length);
  });
});

describe("filterCount", () => {
  const counts = { draft: 2, active: 5, paused: 0, closed: 3 };

  it("reads a status count straight off the record", () => {
    expect(filterCount(counts, "active")).toBe(5);
    expect(filterCount(counts, "paused")).toBe(0);
  });

  it("sums every status for the unfiltered tab", () => {
    expect(filterCount(counts, ALL_STATUSES)).toBe(10);
  });

  it("is zero everywhere when there are no projects", () => {
    const empty = { draft: 0, active: 0, paused: 0, closed: 0 };
    for (const filter of PROJECT_STATUS_FILTERS) {
      expect(filterCount(empty, filter)).toBe(0);
    }
  });

  it("adds up to the unfiltered tab across the status tabs", () => {
    const perStatus = PROJECT_STATUSES.reduce(
      (total, status) => total + filterCount(counts, status),
      0,
    );
    expect(perStatus).toBe(filterCount(counts, ALL_STATUSES));
  });
});
