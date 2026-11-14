import { describe, expect, it } from "vitest";

import { healthSeverity, SCOPE_HEALTH, worstHealth } from "./scope-creep";

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

describe("worstHealth", () => {
  it("takes over above watch", () => {
    expect(worstHealth("watch", "over")).toBe("over");
  });

  it("takes watch above healthy", () => {
    expect(worstHealth("healthy", "watch")).toBe("watch");
  });

  it("does not care which way round the pair comes", () => {
    for (const a of SCOPE_HEALTH) {
      for (const b of SCOPE_HEALTH) {
        expect(worstHealth(a, b)).toBe(worstHealth(b, a));
      }
    }
  });

  it("leaves a pair of the same verdict alone", () => {
    for (const health of SCOPE_HEALTH) {
      expect(worstHealth(health, health)).toBe(health);
    }
  });

  it("folds in any order to the same verdict", () => {
    const states = [...SCOPE_HEALTH];
    const forwards = states.reduce(worstHealth);
    const backwards = [...states].reverse().reduce(worstHealth);
    expect(forwards).toBe(backwards);
    expect(forwards).toBe("over");
  });
});
