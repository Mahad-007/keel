import { describe, expect, it } from "vitest";

import {
  ariaSortFor,
  type ProjectSort,
  PROJECT_SORT_COLUMNS,
  SORT_DIRECTIONS,
  isProjectSortColumn,
  isSortDirection,
  oppositeDirection,
  sortByColumn,
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

describe("sortByColumn", () => {
  it("reverses the column that is already sorted on", () => {
    expect(sortByColumn({ column: "created", direction: "desc" }, "created")).toEqual({
      column: "created",
      direction: "asc",
    });
    expect(sortByColumn({ column: "created", direction: "asc" }, "created")).toEqual({
      column: "created",
      direction: "desc",
    });
  });

  it("starts a different column at newest-first", () => {
    expect(sortByColumn({ column: "created", direction: "asc" }, "updated")).toEqual({
      column: "updated",
      direction: "desc",
    });
  });

  it("does not mutate the sort it was given", () => {
    const current: ProjectSort = { column: "created", direction: "desc" };
    sortByColumn(current, "updated");
    expect(current).toEqual({ column: "created", direction: "desc" });
  });
});

describe("ariaSortFor", () => {
  it("uses the long spellings the attribute expects", () => {
    const sort: ProjectSort = { column: "updated", direction: "asc" };
    expect(ariaSortFor(sort, "updated")).toBe("ascending");
    expect(ariaSortFor({ ...sort, direction: "desc" }, "updated")).toBe(
      "descending",
    );
  });

  it("leaves every other column unsorted", () => {
    const sort: ProjectSort = { column: "updated", direction: "desc" };
    expect(ariaSortFor(sort, "created")).toBe("none");
  });

  it("marks exactly one column for any sort the list can hold", () => {
    for (const column of PROJECT_SORT_COLUMNS) {
      for (const direction of SORT_DIRECTIONS) {
        const marked = PROJECT_SORT_COLUMNS.filter(
          (candidate) => ariaSortFor({ column, direction }, candidate) !== "none",
        );
        expect(marked).toEqual([column]);
      }
    }
  });
});
