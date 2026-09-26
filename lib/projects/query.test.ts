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
