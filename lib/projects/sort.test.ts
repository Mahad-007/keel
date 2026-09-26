import { describe, expect, it } from "vitest";

import {
  PROJECT_SORT_COLUMNS,
  isProjectSortColumn,
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
