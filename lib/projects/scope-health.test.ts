import { describe, expect, it } from "vitest";

import { SCOPE_HEALTH, type ScopeHealth } from "@/lib/scope-creep";

import {
  describeNearlySpentContract,
  describeOverspentContract,
  formatSharePoints,
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
  scopeHealthHeadline,
} from "./scope-health";

describe("the banner's heading", () => {
  it("names every verdict the classifier can reach", () => {
    for (const health of SCOPE_HEALTH) {
      expect(scopeHealthHeadline(health)).toBe(SCOPE_HEALTH_HEADLINE[health]);
    }
  });

  it("gives each verdict a heading of its own", () => {
    const headlines = SCOPE_HEALTH.map(
      (health: ScopeHealth) => SCOPE_HEALTH_HEADLINE[health],
    );

    expect(new Set(headlines).size).toBe(SCOPE_HEALTH.length);
  });

  it("says a verdict was withheld rather than leaving the heading empty", () => {
    expect(scopeHealthHeadline(null)).toBe(NOT_ASSESSED_HEADLINE);
  });

  it("does not reuse a verdict's heading for the withheld one", () => {
    for (const health of SCOPE_HEALTH) {
      expect(SCOPE_HEALTH_HEADLINE[health]).not.toBe(NOT_ASSESSED_HEADLINE);
    }
  });
});

describe("a gap written in percentage points", () => {
  it("rounds to whole points, matching the shares either side of it", () => {
    expect(formatSharePoints(0.5)).toBe("50 points");
    expect(formatSharePoints(0.274)).toBe("27 points");
    expect(formatSharePoints(0.276)).toBe("28 points");
  });

  it("says a single point in the singular", () => {
    expect(formatSharePoints(0.01)).toBe("1 point");
  });

  it("does not round a gap that exists away to nothing", () => {
    expect(formatSharePoints(0.001)).toBe("less than a point");
  });

  it("writes no gap at all as none", () => {
    expect(formatSharePoints(0)).toBe("0 points");
  });

  it("writes a gap the other way round with its sign", () => {
    // Delivery ahead of the burn, which is a project doing well. The classifier
    // never flags it, and the portfolio ranking will still print it.
    expect(formatSharePoints(-0.2)).toBe("-20 points");
  });
});

describe("the sentence for a contract already spent", () => {
  it("leads with the share the hours have burned", () => {
    expect(describeOverspentContract(1.12)).toContain("112% of the contract");
  });

  it("names the consequence rather than restating the share", () => {
    expect(describeOverspentContract(1.12)).toContain(
      "the agreement does not pay for",
    );
  });

  it("rounds the share the way the burn panel rounds it", () => {
    // A hair over the contract must not read as exactly spent: a reader told
    // "100%" stops looking, and this is the project to keep looking at.
    expect(describeOverspentContract(1.001)).toContain("more than 100%");
  });

  it("says exactly spent as exactly spent", () => {
    expect(describeOverspentContract(1)).toContain("100% of the contract");
  });
});

describe("the sentence for a contract nearly spent", () => {
  it("leads with the share the hours have burned", () => {
    expect(describeNearlySpentContract(0.84)).toContain(
      "84% of the contract value",
    );
  });

  it("names the outstanding scope that earns the flag", () => {
    expect(describeNearlySpentContract(0.84)).toContain(
      "the scope list is not finished",
    );
  });

  it("says what the remainder has to cover rather than how much it is", () => {
    const sentence = describeNearlySpentContract(0.84);

    expect(sentence).toContain("everything still outstanding");
    // The amount left is on the burn panel an inch below; repeating it here
    // would be one figure twice with nothing added.
    expect(sentence).not.toContain("16%");
  });

  it("reads differently from the sentence for a contract already spent", () => {
    expect(describeNearlySpentContract(0.84)).not.toBe(
      describeOverspentContract(0.84),
    );
  });
});
