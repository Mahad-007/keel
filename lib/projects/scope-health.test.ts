import { describe, expect, it } from "vitest";

import { SCOPE_HEALTH, type ScopeHealth } from "@/lib/scope-creep";

import {
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
