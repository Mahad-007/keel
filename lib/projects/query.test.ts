import { describe, expect, it } from "vitest";

import { PROJECT_STATUS_FILTERS } from "./filter";
import { PROJECT_SORT_COLUMNS, SORT_DIRECTIONS } from "./sort";
import {
  DEFAULT_PROJECTS_QUERY,
  PROJECTS_PATH,
  parseProjectsQuery,
  projectsHref,
  withSortColumn,
  withStatus,
} from "./query";

describe("parseProjectsQuery", () => {
  it("reads a fully specified query", () => {
    expect(
      parseProjectsQuery({ status: "paused", sort: "updated", direction: "asc" }),
    ).toEqual({
      status: "paused",
      sort: { column: "updated", direction: "asc" },
    });
  });

  it("treats no params as everything, newest first", () => {
    expect(parseProjectsQuery({})).toEqual(DEFAULT_PROJECTS_QUERY);
  });

  it("ignores params the list knows nothing about", () => {
    expect(parseProjectsQuery({ page: "3", q: "rebuild" })).toEqual(
      DEFAULT_PROJECTS_QUERY,
    );
  });
});

describe("parseProjectsQuery with junk params", () => {
  it("keeps the good params when one is unrecognised", () => {
    expect(
      parseProjectsQuery({ status: "closed", sort: "name", direction: "asc" }),
    ).toEqual({
      status: "closed",
      sort: { column: "created", direction: "asc" },
    });
  });

  it("keeps the sort when the status is a stale bookmark", () => {
    expect(
      parseProjectsQuery({ status: "archived", sort: "updated" }),
    ).toEqual({
      status: "all",
      sort: { column: "updated", direction: "desc" },
    });
  });

  it("falls back on a blank param rather than sorting by nothing", () => {
    expect(parseProjectsQuery({ status: "", sort: "", direction: "" })).toEqual(
      DEFAULT_PROJECTS_QUERY,
    );
  });

  it("honours the first value when a param is repeated", () => {
    expect(
      parseProjectsQuery({
        status: ["active", "closed"],
        sort: ["updated", "created"],
        direction: ["asc", "desc"],
      }),
    ).toEqual({
      status: "active",
      sort: { column: "updated", direction: "asc" },
    });
  });

  it("falls back when a repeated param's first value is the bad one", () => {
    expect(parseProjectsQuery({ status: ["nope", "active"] })).toEqual(
      DEFAULT_PROJECTS_QUERY,
    );
  });
});

describe("projectsHref", () => {
  it("is the bare path for the default list", () => {
    expect(projectsHref(DEFAULT_PROJECTS_QUERY)).toBe(PROJECTS_PATH);
  });

  it("names only the params that differ from the default", () => {
    expect(
      projectsHref({ status: "active", sort: { column: "created", direction: "desc" } }),
    ).toBe("/projects?status=active");
    expect(
      projectsHref({ status: "all", sort: { column: "updated", direction: "desc" } }),
    ).toBe("/projects?sort=updated");
    expect(
      projectsHref({ status: "all", sort: { column: "created", direction: "asc" } }),
    ).toBe("/projects?direction=asc");
  });

  it("names all three when all three differ", () => {
    expect(
      projectsHref({ status: "closed", sort: { column: "updated", direction: "asc" } }),
    ).toBe("/projects?status=closed&sort=updated&direction=asc");
  });

  it("round-trips every query the list can hold", () => {
    for (const status of PROJECT_STATUS_FILTERS) {
      for (const column of PROJECT_SORT_COLUMNS) {
        for (const direction of SORT_DIRECTIONS) {
          const query = { status, sort: { column, direction } };
          const search = new URL(projectsHref(query), "https://keel.test")
            .searchParams;
          expect(parseProjectsQuery(Object.fromEntries(search))).toEqual(query);
        }
      }
    }
  });
});

describe("withStatus", () => {
  it("keeps the sort the reader chose", () => {
    const query = {
      status: "all" as const,
      sort: { column: "updated" as const, direction: "asc" as const },
    };
    expect(withStatus(query, "active")).toEqual({
      status: "active",
      sort: { column: "updated", direction: "asc" },
    });
  });

  it("leads back to the bare path when the filter is cleared", () => {
    const query = parseProjectsQuery({ status: "closed" });
    expect(projectsHref(withStatus(query, "all"))).toBe(PROJECTS_PATH);
  });
});

describe("withSortColumn", () => {
  it("keeps the filter while reversing the sorted column", () => {
    const query = parseProjectsQuery({ status: "active" });
    expect(projectsHref(withSortColumn(query, "created"))).toBe(
      "/projects?status=active&direction=asc",
    );
  });

  it("moves to a new column at newest-first", () => {
    const query = parseProjectsQuery({ status: "active", direction: "asc" });
    expect(projectsHref(withSortColumn(query, "updated"))).toBe(
      "/projects?status=active&sort=updated",
    );
  });

  it("returns to the query it started from when clicked twice", () => {
    const query = parseProjectsQuery({ sort: "updated" });
    expect(withSortColumn(withSortColumn(query, "updated"), "updated")).toEqual(
      query,
    );
  });
});
