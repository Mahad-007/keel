import { describe, expect, it } from "vitest";

import { healthSeverity, SCOPE_HEALTH } from "./scope-creep";

describe("SCOPE_HEALTH", () => {
  it("lists the three verdicts", () => {
    expect(SCOPE_HEALTH).toEqual(["healthy", "watch", "over"]);
  });
});

describe("healthSeverity", () => {
  it("ranks the verdicts in worsening order", () => {
    expect(healthSeverity("healthy")).toBeLessThan(healthSeverity("watch"));
    expect(healthSeverity("watch")).toBeLessThan(healthSeverity("over"));
  });

  it("gives every verdict a place in the order", () => {
    for (const health of SCOPE_HEALTH) {
      expect(healthSeverity(health)).toBeGreaterThanOrEqual(0);
    }
  });
});
