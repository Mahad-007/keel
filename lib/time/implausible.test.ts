import { describe, expect, it } from "vitest";

import {
  IMPLAUSIBLE_ENTRY_MINUTES,
  negativeEntry,
  overlongEntry,
} from "./implausible";

describe("an entry recording less than no time", () => {
  it("flags a duration below zero", () => {
    expect(negativeEntry({ minutes: -30 })).toBe(true);
  });

  it("leaves an ordinary duration alone", () => {
    expect(negativeEntry({ minutes: 90 })).toBe(false);
  });

  it("leaves zero alone", () => {
    // It counts for nothing in every total, which is the same as not being
    // there. A negative one subtracts, which is worse than not being there.
    expect(negativeEntry({ minutes: 0 })).toBe(false);
  });

  it("flags the first minute below zero", () => {
    expect(negativeEntry({ minutes: -1 })).toBe(true);
  });
});

describe("one stretch longer than a stretch plausibly is", () => {
  it("flags thirteen hours", () => {
    expect(overlongEntry({ minutes: 13 * 60 })).toBe(true);
  });

  it("leaves twelve hours alone", () => {
    // A day somebody had, and a round figure that gets typed on purpose.
    expect(overlongEntry({ minutes: IMPLAUSIBLE_ENTRY_MINUTES })).toBe(false);
  });

  it("flags the first minute past twelve hours", () => {
    expect(overlongEntry({ minutes: IMPLAUSIBLE_ENTRY_MINUTES + 1 })).toBe(
      true,
    );
  });

  it("leaves an ordinary afternoon alone", () => {
    expect(overlongEntry({ minutes: 210 })).toBe(false);
  });

  it("does not flag a negative duration as a long one", () => {
    // So the two flags cannot both be true of one entry.
    expect(overlongEntry({ minutes: -900 })).toBe(false);
  });
});
