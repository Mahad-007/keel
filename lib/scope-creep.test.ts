import { describe, expect, it } from "vitest";

import {
  classifyConsumedShare,
  creepGap,
  healthSeverity,
  NEARLY_SPENT_SHARE,
  OVERSPENT_SHARE,
  SCOPE_HEALTH,
  worstHealth,
} from "./scope-creep";

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

describe("classifyConsumedShare", () => {
  it("is healthy with barely any of the contract burned", () => {
    expect(classifyConsumedShare(0)).toBe("healthy");
    expect(classifyConsumedShare(0.12)).toBe("healthy");
  });

  it("is over once the whole contract is burned", () => {
    expect(classifyConsumedShare(OVERSPENT_SHARE)).toBe("over");
  });

  it("is over well past the contract", () => {
    expect(classifyConsumedShare(1.68)).toBe("over");
  });

  it("is watch a hair under the contract", () => {
    expect(classifyConsumedShare(0.999)).toBe("watch");
  });
});

describe("classifyConsumedShare at the nearly-spent threshold", () => {
  it("is watch exactly on the threshold", () => {
    expect(classifyConsumedShare(NEARLY_SPENT_SHARE)).toBe("watch");
  });

  it("is healthy a hair under it", () => {
    expect(classifyConsumedShare(NEARLY_SPENT_SHARE - 0.001)).toBe("healthy");
  });

  it("is watch across the whole band up to the contract", () => {
    for (const share of [0.8, 0.85, 0.9, 0.95, 0.99]) {
      expect(classifyConsumedShare(share)).toBe("watch");
    }
  });

  it("treats a share below zero as healthy, having been handed one", () => {
    expect(classifyConsumedShare(-0.4)).toBe("healthy");
  });
});

describe("creepGap", () => {
  it("is nothing when the money and the work are in step", () => {
    expect(creepGap(0.5, 0.5)).toBe(0);
  });

  it("is the money ahead of the work as a positive figure", () => {
    expect(creepGap(0.6, 0.1)).toBeCloseTo(0.5);
  });

  it("is the whole consumed share when nothing is delivered", () => {
    expect(creepGap(0.35, 0)).toBeCloseTo(0.35);
  });

  it("goes below zero when the work is ahead of the money", () => {
    expect(creepGap(0.4, 0.75)).toBeCloseTo(-0.35);
  });

  it("is readable past the contract, where the share is above one", () => {
    expect(creepGap(1.68, 0.5)).toBeCloseTo(1.18);
  });

  it("has nothing to say with no price to take a share of", () => {
    expect(creepGap(null, 0.5)).toBeNull();
  });

  it("has nothing to say with nothing estimated", () => {
    expect(creepGap(0.5, null)).toBeNull();
  });

  it("has nothing to say with neither", () => {
    expect(creepGap(null, null)).toBeNull();
  });
});
