import { describe, expect, it } from "vitest";

import {
  ALL_DATES,
  backwardsEnds,
  describeRange,
  parseRangeEnd,
  rangeFromParams,
  reverseRange,
} from "./range";

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

describe("reverseRange", () => {
  it("swaps the two ends", () => {
    expect(reverseRange({ from: "2026-10-31", to: "2026-10-01" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("turns a backwards range into one that is not", () => {
    const backwards = { from: "2026-10-31", to: "2026-10-01" };
    expect(backwardsEnds(reverseRange(backwards))).toBeNull();
  });

  it("applied twice is the range it started as", () => {
    const range = { from: "2026-10-01", to: null };
    expect(reverseRange(reverseRange(range))).toEqual(range);
  });
});

describe("describeRange", () => {
  it("names a closed range the way the timesheet names a week", () => {
    expect(describeRange({ from: "2026-10-01", to: "2026-10-31" })).toBe(
      "Oct 1 – 31, 2026",
    );
  });

  it("names a range of one day as that day", () => {
    expect(describeRange({ from: "2026-10-16", to: "2026-10-16" })).toBe(
      "Oct 16, 2026",
    );
  });

  it("says since when only the first day is bounded", () => {
    expect(describeRange({ from: "2026-10-01", to: null })).toBe(
      "Since Oct 1, 2026",
    );
  });

  it("says up to when only the last day is bounded", () => {
    expect(describeRange({ from: null, to: "2026-10-31" })).toBe(
      "Up to Oct 31, 2026",
    );
  });

  it("says all time when neither end is bounded", () => {
    expect(describeRange(ALL_DATES)).toBe("All time");
  });

  it("describes a backwards range as it was typed rather than correcting it", () => {
    expect(describeRange({ from: "2026-10-31", to: "2026-10-01" })).toBe(
      "Oct 31 – 1, 2026",
    );
  });
});

describe("backwardsEnds", () => {
  it("hands back both ends of a backwards range", () => {
    expect(backwardsEnds({ from: "2026-10-31", to: "2026-10-01" })).toEqual({
      from: "2026-10-31",
      to: "2026-10-01",
    });
  });

  it("is nothing for a range in the right order", () => {
    expect(backwardsEnds({ from: "2026-10-01", to: "2026-10-31" })).toBeNull();
    expect(backwardsEnds({ from: "2026-10-16", to: "2026-10-16" })).toBeNull();
  });

  it("is nothing when either end is open", () => {
    expect(backwardsEnds({ from: "2026-10-31", to: null })).toBeNull();
    expect(backwardsEnds({ from: null, to: "2026-10-01" })).toBeNull();
  });

  it("finds nothing backwards in any range a parser can produce", () => {
    const ranges = [
      ALL_DATES,
      rangeFromParams("2026-10-01", "2026-10-31"),
      rangeFromParams("2026-10-16", "2026-10-16"),
      rangeFromParams("2026-10-31", undefined),
      rangeFromParams(undefined, "2026-10-01"),
    ];
    for (const range of ranges) expect(backwardsEnds(range)).toBeNull();
  });
});
