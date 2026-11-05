import { describe, expect, it } from "vitest";

import { ANY_BILLING, CHARGEABLE_TIME, FREE_TIME } from "./billable";
import {
  parseIdParam,
  parseTimeLogQuery,
  UNFILTERED_LOG,
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
