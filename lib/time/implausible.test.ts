import { describe, expect, it } from "vitest";

import { negativeEntry } from "./implausible";

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
