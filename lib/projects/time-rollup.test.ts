import { describe, expect, it } from "vitest";

import {
  describeLogged,
  describeShare,
  describeVariance,
  NOTHING_LOGGED_LABEL,
  ON_THE_ESTIMATE_LABEL,
} from "./time-rollup";

describe("a logged total as its cell reads", () => {
  it("reads a duration as hours and minutes", () => {
    expect(describeLogged(390)).toBe("6h 30m");
  });

  it("says nothing has been logged rather than printing a zero duration", () => {
    // `0m` reads as a measurement where the truth is an absence.
    expect(describeLogged(0)).toBe(NOTHING_LOGGED_LABEL);
  });

  it("reads a figure under an hour in minutes", () => {
    expect(describeLogged(45)).toBe("45m");
  });
});

describe("the words for a difference against an estimate", () => {
  it("says how far over a line has run", () => {
    expect(describeVariance(150, false)).toBe("2h 30m over");
  });

  it("says over the same way whether or not the line is done", () => {
    expect(describeVariance(150, true)).toBe("2h 30m over");
  });

  it("gives a line sitting exactly on its estimate its own words", () => {
    // "0m over" is true and nobody reads it as "this one is fine".
    expect(describeVariance(0, false)).toBe(ON_THE_ESTIMATE_LABEL);
    expect(describeVariance(0, true)).toBe(ON_THE_ESTIMATE_LABEL);
  });

  it("calls unspent estimate on an open line budget left", () => {
    expect(describeVariance(-60, false)).toBe("1h left");
  });

  it("calls the same figure on a delivered line coming in under", () => {
    // Budget to spend and budget never needed are opposite news.
    expect(describeVariance(-60, true)).toBe("1h under");
  });

  it("takes the sign off, because the direction is in the word", () => {
    expect(describeVariance(-90, false)).not.toContain("-");
  });
});

describe("the share of an estimate that has gone", () => {
  it("says how much of the estimate a line has used", () => {
    expect(describeShare(1.5)).toBe("150% of it");
  });

  it("rounds the way the scope summary's share rounds", () => {
    expect(describeShare(0.254)).toBe("25% of it");
  });

  it("keeps a runaway line's share rather than capping it", () => {
    expect(describeShare(4)).toBe("400% of it");
  });

  it("says nothing when there was no estimate to take a share of", () => {
    expect(describeShare(null)).toBeNull();
  });

  it("says nothing at nought, which the logged column has already said", () => {
    expect(describeShare(0)).toBeNull();
  });

  it("says nothing at exactly one, which is what on-the-estimate means", () => {
    expect(describeShare(1)).toBeNull();
  });

  it("does not round a line barely started up to nothing", () => {
    // A half-day against a three-month estimate really is less than 1%.
    expect(describeShare(0.001)).toBe("less than 1% of it");
  });

  it("does not round a line short of its estimate up to all of it", () => {
    expect(describeShare(0.999)).toBe("more than 99% of it");
  });
});
