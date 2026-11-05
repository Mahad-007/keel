import { describe, expect, it } from "vitest";

import { ANY_BILLING, CHARGEABLE_TIME, FREE_TIME } from "./billable";
import {
  parseIdParam,
  parseTimeLogQuery,
  timeLogHref,
  UNFILTERED_LOG,
  type TimeLogQuery,
} from "./log-query";
import { ALL_DATES } from "./range";

describe("parseIdParam", () => {
  it("keeps an id", () => {
    expect(parseIdParam("prj_abc")).toBe("prj_abc");
  });

  it("trims the surroundings off one", () => {
    expect(parseIdParam(" prj_abc ")).toBe("prj_abc");
  });

  it("reads an untouched picker as no filter at all", () => {
    expect(parseIdParam("")).toBeNull();
    expect(parseIdParam("   ")).toBeNull();
    expect(parseIdParam(undefined)).toBeNull();
  });
});

describe("parseTimeLogQuery", () => {
  it("is unfiltered when there are no params", () => {
    expect(parseTimeLogQuery({})).toEqual(UNFILTERED_LOG);
  });

  it("reads all four filters", () => {
    expect(
      parseTimeLogQuery({
        from: "2026-10-01",
        to: "2026-10-31",
        project: "prj_abc",
        client: "cli_xyz",
        billable: CHARGEABLE_TIME,
      }),
    ).toEqual({
      range: { from: "2026-10-01", to: "2026-10-31" },
      projectId: "prj_abc",
      clientId: "cli_xyz",
      billable: CHARGEABLE_TIME,
    });
  });

  it("takes the first of a repeated param", () => {
    const query = parseTimeLogQuery({
      project: ["prj_first", "prj_second"],
      billable: [FREE_TIME, CHARGEABLE_TIME],
    });
    expect(query.projectId).toBe("prj_first");
    expect(query.billable).toBe(FREE_TIME);
  });

  it("drops one mangled param without losing the others", () => {
    const query = parseTimeLogQuery({
      from: "last Tuesday",
      to: "2026-10-31",
      billable: "sort-of",
      project: "prj_abc",
    });
    expect(query.range).toEqual({ from: null, to: "2026-10-31" });
    expect(query.billable).toBe(ANY_BILLING);
    expect(query.projectId).toBe("prj_abc");
  });

  it("reads a form that submitted its empty boxes as no filter", () => {
    expect(
      parseTimeLogQuery({
        from: "",
        to: "",
        project: "",
        client: "",
        billable: ANY_BILLING,
      }),
    ).toEqual(UNFILTERED_LOG);
  });

  it("leaves one end of the range open", () => {
    expect(parseTimeLogQuery({ from: "2026-10-01" }).range).toEqual({
      from: "2026-10-01",
      to: null,
    });
  });

  it("keeps an unfiltered range as every date there is", () => {
    expect(parseTimeLogQuery({ project: "prj_abc" }).range).toEqual(ALL_DATES);
  });
});

describe("timeLogHref", () => {
  it("is the bare path when nothing is filtered", () => {
    expect(timeLogHref(UNFILTERED_LOG)).toBe("/time/entries");
  });

  it("carries every filter that is set", () => {
    expect(
      timeLogHref({
        range: { from: "2026-10-01", to: "2026-10-31" },
        projectId: "prj_abc",
        clientId: "cli_xyz",
        billable: FREE_TIME,
      }),
    ).toBe(
      "/time/entries?from=2026-10-01&to=2026-10-31&client=cli_xyz&project=prj_abc&billable=free",
    );
  });

  it("leaves out the end of the range that is open", () => {
    expect(
      timeLogHref({ ...UNFILTERED_LOG, range: { from: "2026-10-01", to: null } }),
    ).toBe("/time/entries?from=2026-10-01");
  });

  it("leaves out the billing filter that shows everything", () => {
    expect(timeLogHref({ ...UNFILTERED_LOG, billable: ANY_BILLING })).toBe(
      "/time/entries",
    );
  });

  it("round-trips a query through its own URL", () => {
    const query: TimeLogQuery = {
      range: { from: "2026-09-17", to: null },
      projectId: "prj_abc",
      clientId: null,
      billable: CHARGEABLE_TIME,
    };
    const search = new URL(timeLogHref(query), "https://keel.test").searchParams;
    expect(parseTimeLogQuery(Object.fromEntries(search))).toEqual(query);
  });

  it("escapes an id that would otherwise break the URL", () => {
    expect(
      timeLogHref({ ...UNFILTERED_LOG, projectId: "prj a&b" }),
    ).toBe("/time/entries?project=prj+a%26b");
  });
});
