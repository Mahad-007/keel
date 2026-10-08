import { describe, expect, it } from "vitest";

import { hoursPhrase } from "./scope-summary";

describe("hoursPhrase", () => {
  it("writes a whole figure with its unit", () => {
    expect(hoursPhrase(40)).toBe("40 hours");
  });

  it("writes one hour singular", () => {
    expect(hoursPhrase(1)).toBe("1 hour");
  });

  it("keeps a part of an hour as the decimal it came in as", () => {
    expect(hoursPhrase(1.5)).toBe("1.5 hours");
    expect(hoursPhrase(0.25)).toBe("0.25 hours");
  });

  it("does not round a figure that was already rounded for it", () => {
    expect(hoursPhrase(1.67)).toBe("1.67 hours");
  });

  it("writes no hours as a plural, the way nothing is spoken of", () => {
    expect(hoursPhrase(0)).toBe("0 hours");
  });
});
