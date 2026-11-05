import { describe, expect, it } from "vitest";

import { ALL_DATES, parseRangeEnd, rangeFromParams } from "./range";

describe("parseRangeEnd", () => {
  it("keeps a calendar date", () => {
    expect(parseRangeEnd("2026-10-16")).toBe("2026-10-16");
  });

  it("opens the end when the param is absent", () => {
    expect(parseRangeEnd(undefined)).toBeNull();
  });

  it("opens the end rather than failing on a half-typed date", () => {
    expect(parseRangeEnd("2026-10")).toBeNull();
    expect(parseRangeEnd("")).toBeNull();
    expect(parseRangeEnd("yesterday")).toBeNull();
  });

  it("opens the end on a day that does not exist", () => {
    expect(parseRangeEnd("2026-02-30")).toBeNull();
  });

  it("refuses a timestamp rather than reading the day off the front", () => {
    expect(parseRangeEnd("2026-10-16T09:00:00.000Z")).toBeNull();
  });
});

describe("rangeFromParams", () => {
  it("reads both ends", () => {
    expect(rangeFromParams("2026-10-01", "2026-10-31")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("leaves one end open when only the other is given", () => {
    expect(rangeFromParams("2026-10-01", undefined)).toEqual({
      from: "2026-10-01",
      to: null,
    });
    expect(rangeFromParams(undefined, "2026-10-31")).toEqual({
      from: null,
      to: "2026-10-31",
    });
  });

  it("is every day there is when neither param is given", () => {
    expect(rangeFromParams(undefined, undefined)).toEqual(ALL_DATES);
  });

  it("drops one mangled end without losing the other", () => {
    expect(rangeFromParams("nonsense", "2026-10-31")).toEqual({
      from: null,
      to: "2026-10-31",
    });
  });
});
