import { describe, expect, it } from "vitest";

import { describeEstimate, UNESTIMATED_LABEL } from "./list";

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
