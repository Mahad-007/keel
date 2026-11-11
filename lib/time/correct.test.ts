import { describe, expect, it } from "vitest";

import { suggestedMinutes } from "./correct";
import { IMPLAUSIBLE_ENTRY_MINUTES } from "./implausible";

describe("the duration a flagged entry would most likely have been", () => {
  it("takes the minus off a negative duration", () => {
    expect(suggestedMinutes({ minutes: -90 })).toBe(90);
  });

  it("reads a whole number of hours as a slipped unit", () => {
    expect(suggestedMinutes({ minutes: 13 * 60 })).toBe(13);
  });

  it("makes no guess at a long stretch with minutes on the end", () => {
    // Nothing in a slipped unit would have produced the ten minutes.
    expect(suggestedMinutes({ minutes: 13 * 60 + 10 })).toBeNull();
  });

  it("makes no guess about an entry nothing is wrong with", () => {
    expect(suggestedMinutes({ minutes: 90 })).toBeNull();
  });

  it("makes no guess at twelve hours, which is not flagged", () => {
    expect(suggestedMinutes({ minutes: IMPLAUSIBLE_ENTRY_MINUTES })).toBeNull();
  });

  it("refuses to offer a figure that would itself be flagged", () => {
    // -13h is a negative entry whose magnitude is still past twelve hours, so
    // pressing the offer would leave the caveat exactly where it was.
    expect(suggestedMinutes({ minutes: -13 * 60 })).toBeNull();
  });

  it("refuses to offer nothing at all", () => {
    expect(suggestedMinutes({ minutes: -0 })).toBeNull();
  });

  it("refuses a slip that would still be a long stretch", () => {
    // 100000 hours divided by sixty is still past the threshold.
    expect(suggestedMinutes({ minutes: 100000 * 60 })).toBeNull();
  });

  it("offers the smallest correction a negative entry can need", () => {
    expect(suggestedMinutes({ minutes: -1 })).toBe(1);
  });

  it("offers thirteen minutes for the first flagged whole hour", () => {
    expect(suggestedMinutes({ minutes: 13 * 60 })).toBe(13);
  });
});
