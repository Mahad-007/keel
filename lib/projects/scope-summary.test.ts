import { describe, expect, it } from "vitest";

import {
  deliverablesPhrase,
  formatSharePercent,
  hoursPhrase,
} from "./scope-summary";

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

describe("deliverablesPhrase", () => {
  it("counts a list of several", () => {
    expect(deliverablesPhrase(5)).toBe("5 deliverables");
  });

  it("counts a list of one in the singular", () => {
    expect(deliverablesPhrase(1)).toBe("1 deliverable");
  });

  it("counts an empty list as a plural none", () => {
    expect(deliverablesPhrase(0)).toBe("0 deliverables");
  });
});

describe("formatSharePercent", () => {
  it("writes a fraction as a whole percent", () => {
    expect(formatSharePercent(0.25)).toBe("25%");
  });

  it("rounds to the nearest percent rather than cutting it off", () => {
    expect(formatSharePercent(0.306)).toBe("31%");
    expect(formatSharePercent(0.304)).toBe("30%");
  });

  it("writes nothing delivered as none of it", () => {
    expect(formatSharePercent(0)).toBe("0%");
  });

  it("writes the whole estimate delivered as all of it", () => {
    expect(formatSharePercent(1)).toBe("100%");
  });

  it("says less than a percent rather than rounding a delivery away", () => {
    expect(formatSharePercent(0.004)).toBe("less than 1%");
    expect(formatSharePercent(0.0001)).toBe("less than 1%");
  });

  it("does not clamp a share a bad estimate pushed over one", () => {
    expect(formatSharePercent(1.5)).toBe("150%");
  });

  it("does not clamp a share a bad estimate pushed below zero", () => {
    expect(formatSharePercent(-0.2)).toBe("-20%");
  });
});
