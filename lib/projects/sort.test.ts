import { describe, expect, it } from "vitest";

import {
  PROJECT_SORT_COLUMNS,
  SORT_DIRECTIONS,
  isProjectSortColumn,
  isSortDirection,
  oppositeDirection,
} from "./sort";

describe("isProjectSortColumn", () => {
  it("accepts every column the list offers", () => {
    for (const column of PROJECT_SORT_COLUMNS) {
      expect(isProjectSortColumn(column)).toBe(true);
    }
  });

  it("rejects a column name from the database rather than the URL", () => {
    expect(isProjectSortColumn("created_at")).toBe(false);
    expect(isProjectSortColumn("createdAt")).toBe(false);
    expect(isProjectSortColumn("name")).toBe(false);
  });

  it("rejects a value that is merely column-shaped", () => {
    expect(isProjectSortColumn("Created")).toBe(false);
    expect(isProjectSortColumn(" created")).toBe(false);
    expect(isProjectSortColumn("")).toBe(false);
  });

  it("rejects the repeated-param array Next hands back for ?sort=a&sort=b", () => {
    expect(isProjectSortColumn(["created"])).toBe(false);
    expect(isProjectSortColumn(undefined)).toBe(false);
    expect(isProjectSortColumn(null)).toBe(false);
  });
});

describe("isSortDirection", () => {
  it("accepts both directions", () => {
    for (const direction of SORT_DIRECTIONS) {
      expect(isSortDirection(direction)).toBe(true);
    }
  });

  it("rejects the spellings a hand-edited URL is likely to carry", () => {
    expect(isSortDirection("ascending")).toBe(false);
    expect(isSortDirection("descending")).toBe(false);
    expect(isSortDirection("DESC")).toBe(false);
    expect(isSortDirection("")).toBe(false);
    expect(isSortDirection(undefined)).toBe(false);
  });
});

describe("oppositeDirection", () => {
  it("flips each direction to the other", () => {
    expect(oppositeDirection("desc")).toBe("asc");
    expect(oppositeDirection("asc")).toBe("desc");
  });

  it("returns to where it started when flipped twice", () => {
    for (const direction of SORT_DIRECTIONS) {
      expect(oppositeDirection(oppositeDirection(direction))).toBe(direction);
    }
  });
});
