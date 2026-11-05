import { describe, expect, it } from "vitest";

import { compareNames } from "./names";

describe("compareNames", () => {
  it("orders two names alphabetically", () => {
    expect(compareNames("Acme", "Beta")).toBeLessThan(0);
    expect(compareNames("Beta", "Acme")).toBeGreaterThan(0);
  });

  it("ignores case, so a lower-case name is not sorted to the end", () => {
    expect(compareNames("acme", "Zephyr")).toBeLessThan(0);
  });

  it("is zero for the same name", () => {
    expect(compareNames("Acme", "Acme")).toBe(0);
  });

  it("gives two names differing only in case a fixed order", () => {
    expect(compareNames("acme", "Acme")).toBeGreaterThan(0);
    expect(compareNames("Acme", "acme")).toBeLessThan(0);
  });

  it("sorts a list the way a person reads one", () => {
    const names = ["zephyr", "Acme", "beta", "Beta"];
    expect([...names].sort(compareNames)).toEqual([
      "Acme",
      "Beta",
      "beta",
      "zephyr",
    ]);
  });
});
