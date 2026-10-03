import { describe, expect, it } from "vitest";

import { describeEstimate, isEstimated, UNESTIMATED_LABEL } from "./list";

describe("describeEstimate", () => {
  it("writes an estimate as a duration", () => {
    expect(describeEstimate(90)).toBe("1h 30m");
    expect(describeEstimate(30)).toBe("30m");
  });

  it("says a zero is a missing estimate rather than printing 0m", () => {
    expect(describeEstimate(0)).toBe(UNESTIMATED_LABEL);
  });

  it("shows a negative estimate rather than hiding a bad row as missing", () => {
    expect(describeEstimate(-30)).toBe("-30m");
  });
});

describe("isEstimated", () => {
  it("agrees with the words describeEstimate chooses", () => {
    for (const minutes of [0, 1, 90, -30]) {
      expect(isEstimated(minutes)).toBe(
        describeEstimate(minutes) !== UNESTIMATED_LABEL,
      );
    }
  });

  it("counts a zero as unsized and anything else as sized", () => {
    expect(isEstimated(0)).toBe(false);
    expect(isEstimated(1)).toBe(true);
  });
});
