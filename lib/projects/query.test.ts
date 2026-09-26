import { describe, expect, it } from "vitest";

import { DEFAULT_PROJECTS_QUERY, parseProjectsQuery } from "./query";

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
