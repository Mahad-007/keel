import { describe, expect, it } from "vitest";

import { describeLogged, NOTHING_LOGGED_LABEL } from "./time-rollup";

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
