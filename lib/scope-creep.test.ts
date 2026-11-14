import { describe, expect, it } from "vitest";

import {
  AHEAD_OF_DELIVERY_GAP,
  assessScopeCreep,
  classifyConsumedShare,
  classifyCreepGap,
  classifyScopeCreep,
  creepBlindSpots,
  creepGap,
  creepReasons,
  type CreepReadings,
  FAR_AHEAD_OF_DELIVERY_GAP,
  healthSeverity,
  NEARLY_SPENT_SHARE,
  OVERSPENT_SHARE,
  readConsumedShare,
  REASON_HEALTH,
  SCOPE_HEALTH,
  worstHealth,
} from "./scope-creep";

/**
 * Readings for a project halfway through its budget and its scope, which is
 * the shape every test below varies one figure of.
 */
function readings(partial: Partial<CreepReadings> = {}): CreepReadings {
  return {
    consumedShare: 0.5,
    deliveredShare: 0.5,
    burnValued: true,
    scopeDelivered: false,
    ...partial,
  };
}

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

describe("classifyCreepGap", () => {
  it("is healthy with the money and the work in step", () => {
    expect(classifyCreepGap(0)).toBe("healthy");
  });

  it("is over half the contract ahead of the delivery", () => {
    expect(classifyCreepGap(FAR_AHEAD_OF_DELIVERY_GAP)).toBe("over");
  });

  it("is over far past that", () => {
    expect(classifyCreepGap(0.9)).toBe("over");
  });

  it("is watch a hair under the far-ahead gap", () => {
    expect(classifyCreepGap(FAR_AHEAD_OF_DELIVERY_GAP - 0.001)).toBe("watch");
  });

  it("is watch exactly a quarter ahead", () => {
    expect(classifyCreepGap(AHEAD_OF_DELIVERY_GAP)).toBe("watch");
  });

  it("is healthy a hair under a quarter ahead", () => {
    expect(classifyCreepGap(AHEAD_OF_DELIVERY_GAP - 0.001)).toBe("healthy");
  });

  it("is healthy when the work is ahead of the money", () => {
    expect(classifyCreepGap(-0.6)).toBe("healthy");
  });

  it("has no opinion when the gap could not be read", () => {
    expect(classifyCreepGap(null)).toBe("healthy");
  });
});

describe("readConsumedShare", () => {
  it("passes a share of a real price straight through", () => {
    expect(readConsumedShare(readings({ consumedShare: 0.42 }))).toBe(0.42);
  });

  it("passes a share past the contract through unclamped", () => {
    expect(readConsumedShare(readings({ consumedShare: 1.68 }))).toBe(1.68);
  });

  it("has no share when there is no price to divide by", () => {
    expect(readConsumedShare(readings({ consumedShare: null }))).toBeNull();
  });

  it("refuses the nought that an unvalued burn divides out to", () => {
    expect(
      readConsumedShare(readings({ consumedShare: 0, burnValued: false })),
    ).toBeNull();
  });

  it("refuses a real-looking share when the burn was never valued", () => {
    expect(
      readConsumedShare(readings({ consumedShare: 0.4, burnValued: false })),
    ).toBeNull();
  });

  it("refuses a share below zero, which a negative rate produces", () => {
    expect(readConsumedShare(readings({ consumedShare: -0.5 }))).toBeNull();
  });

  it("keeps a share of exactly nothing on a project nobody has worked on", () => {
    expect(readConsumedShare(readings({ consumedShare: 0 }))).toBe(0);
  });
});

describe("creepBlindSpots", () => {
  it("finds nothing missing on a project with a price and estimates", () => {
    expect(creepBlindSpots(readings())).toEqual([]);
  });

  it("names the missing price", () => {
    expect(creepBlindSpots(readings({ consumedShare: null }))).toEqual([
      "no-contract-value",
    ]);
  });

  it("names the unvalued burn", () => {
    expect(
      creepBlindSpots(readings({ consumedShare: 0, burnValued: false })),
    ).toEqual(["burn-not-valued"]);
  });

  it("names the burn below zero", () => {
    expect(creepBlindSpots(readings({ consumedShare: -0.2 }))).toEqual([
      "burn-below-zero",
    ]);
  });

  it("names the missing estimates", () => {
    expect(creepBlindSpots(readings({ deliveredShare: null }))).toEqual([
      "scope-not-estimated",
    ]);
  });

  it("says the price once rather than the rate as well", () => {
    expect(
      creepBlindSpots(readings({ consumedShare: null, burnValued: false })),
    ).toEqual(["no-contract-value"]);
  });

  it("stacks a missing price with missing estimates", () => {
    expect(
      creepBlindSpots(readings({ consumedShare: null, deliveredShare: null })),
    ).toEqual(["no-contract-value", "scope-not-estimated"]);
  });

  it("stacks an unvalued burn with missing estimates", () => {
    expect(
      creepBlindSpots(
        readings({ consumedShare: 0, burnValued: false, deliveredShare: null }),
      ),
    ).toEqual(["burn-not-valued", "scope-not-estimated"]);
  });

  it("finds nothing missing on a project nobody has logged against", () => {
    expect(creepBlindSpots(readings({ consumedShare: 0 }))).toEqual([]);
  });
});

describe("creepReasons on the contract axis", () => {
  it("flags nothing on a project halfway through its budget", () => {
    expect(creepReasons(readings())).toEqual([]);
  });

  it("flags a contract burned in full", () => {
    expect(creepReasons(readings({ consumedShare: 1 }))).toContain(
      "contract-overspent",
    );
  });

  it("flags a contract burned well past its value", () => {
    expect(creepReasons(readings({ consumedShare: 1.68 }))).toContain(
      "contract-overspent",
    );
  });

  it("flags a contract nearly spent", () => {
    expect(creepReasons(readings({ consumedShare: 0.85 }))).toContain(
      "contract-nearly-spent",
    );
  });

  it("does not call a nearly-spent contract overspent as well", () => {
    expect(creepReasons(readings({ consumedShare: 0.85 }))).not.toContain(
      "contract-overspent",
    );
  });

  it("does not call an overspent contract nearly spent as well", () => {
    expect(creepReasons(readings({ consumedShare: 1.2 }))).not.toContain(
      "contract-nearly-spent",
    );
  });

  it("flags nothing when the burn could not be valued", () => {
    expect(
      creepReasons(readings({ consumedShare: 0, burnValued: false })),
    ).toEqual([]);
  });

  it("flags nothing when there is no price to measure against", () => {
    expect(creepReasons(readings({ consumedShare: null }))).toEqual([]);
  });
});

describe("creepReasons on the delivery axis", () => {
  it("flags high burn against low completion, which is the whole point", () => {
    expect(
      creepReasons(readings({ consumedShare: 0.6, deliveredShare: 0.1 })),
    ).toEqual(["burn-far-ahead-of-delivery"]);
  });

  it("flags it while the contract axis alone still reads healthy", () => {
    expect(classifyConsumedShare(0.6)).toBe("healthy");
  });

  it("flags a quarter of the contract ahead of the work as watch", () => {
    expect(
      creepReasons(readings({ consumedShare: 0.45, deliveredShare: 0.2 })),
    ).toEqual(["burn-ahead-of-delivery"]);
  });

  it("flags nothing when the money and the work keep step", () => {
    expect(
      creepReasons(readings({ consumedShare: 0.7, deliveredShare: 0.65 })),
    ).toEqual([]);
  });

  it("flags nothing when the work is ahead of the money", () => {
    expect(
      creepReasons(readings({ consumedShare: 0.3, deliveredShare: 0.8 })),
    ).toEqual([]);
  });

  it("flags nothing on the gap when there is nothing estimated", () => {
    expect(
      creepReasons(readings({ consumedShare: 0.6, deliveredShare: null })),
    ).toEqual([]);
  });

  it("leads with the contract when both axes are over", () => {
    expect(
      creepReasons(readings({ consumedShare: 1.4, deliveredShare: 0.2 })),
    ).toEqual(["contract-overspent", "burn-far-ahead-of-delivery"]);
  });

  it("leads with the gap when it is over and the contract only watch", () => {
    expect(
      creepReasons(readings({ consumedShare: 0.9, deliveredShare: 0.1 })),
    ).toEqual(["burn-far-ahead-of-delivery", "contract-nearly-spent"]);
  });
});

describe("creepReasons on a project whose scope is all delivered", () => {
  const finished = { deliveredShare: 1, scopeDelivered: true };

  it("does not flag a contract nearly spent on finished work", () => {
    expect(creepReasons(readings({ ...finished, consumedShare: 0.9 }))).toEqual(
      [],
    );
  });

  it("does not flag it even at a hair under the contract", () => {
    expect(
      creepReasons(readings({ ...finished, consumedShare: 0.999 })),
    ).toEqual([]);
  });

  it("still flags a contract that was overspent to finish", () => {
    expect(creepReasons(readings({ ...finished, consumedShare: 1.3 }))).toEqual(
      ["contract-overspent", "burn-ahead-of-delivery"],
    );
  });

  it("flags an unscoped project nearing its contract, having no list done", () => {
    expect(
      creepReasons(
        readings({
          consumedShare: 0.9,
          deliveredShare: null,
          scopeDelivered: false,
        }),
      ),
    ).toEqual(["contract-nearly-spent"]);
  });

  it("does not excuse a burn far ahead of a scope claiming to be done", () => {
    expect(
      creepReasons(
        readings({ consumedShare: 1.6, deliveredShare: 1, scopeDelivered: true }),
      ),
    ).toEqual(["contract-overspent", "burn-far-ahead-of-delivery"]);
  });
});

describe("classifyScopeCreep", () => {
  it("is healthy on a project tracking its budget", () => {
    expect(classifyScopeCreep(readings())).toBe("healthy");
  });

  it("is healthy on a project nobody has logged against yet", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0, deliveredShare: 0 })),
    ).toBe("healthy");
  });

  it("is watch on a contract nearly spent", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0.85, deliveredShare: 0.8 })),
    ).toBe("watch");
  });

  it("is over on a contract burned past its value", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 1.2, deliveredShare: 1 })),
    ).toBe("over");
  });

  it("is over on high burn against low completion", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0.6, deliveredShare: 0.1 })),
    ).toBe("over");
  });

  it("is watch on a quarter of the contract ahead of the work", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0.45, deliveredShare: 0.2 })),
    ).toBe("watch");
  });

  it("is healthy on a project delivered inside its budget", () => {
    expect(
      classifyScopeCreep(
        readings({ consumedShare: 0.9, deliveredShare: 1, scopeDelivered: true }),
      ),
    ).toBe("healthy");
  });
});

describe("classifyScopeCreep where the burn cannot be read", () => {
  it("withholds a verdict with no contract value", () => {
    expect(classifyScopeCreep(readings({ consumedShare: null }))).toBeNull();
  });

  it("withholds a verdict on hours with no rate anywhere", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0, burnValued: false })),
    ).toBeNull();
  });

  it("withholds a verdict on a burn below zero", () => {
    expect(classifyScopeCreep(readings({ consumedShare: -0.3 }))).toBeNull();
  });

  it("never calls an unreadable burn healthy", () => {
    for (const unreadable of [
      readings({ consumedShare: null }),
      readings({ consumedShare: 0, burnValued: false }),
      readings({ consumedShare: -0.3 }),
    ]) {
      expect(classifyScopeCreep(unreadable)).not.toBe("healthy");
    }
  });

  it("still says the contract is overspent with nothing estimated", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 1.4, deliveredShare: null })),
    ).toBe("over");
  });

  it("still says a contract is nearly spent with nothing estimated", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0.9, deliveredShare: null })),
    ).toBe("watch");
  });

  it("is healthy on an unestimated project with plenty of budget left", () => {
    expect(
      classifyScopeCreep(readings({ consumedShare: 0.2, deliveredShare: null })),
    ).toBe("healthy");
  });
});

describe("classifyScopeCreep against its reasons", () => {
  const shares = [0, 0.2, 0.5, 0.79, 0.8, 0.99, 1, 1.5];

  it("is the worst of the reasons it reports, over every pair of shares", () => {
    for (const consumedShare of shares) {
      for (const deliveredShare of shares) {
        const reading = readings({ consumedShare, deliveredShare });
        const reasons = creepReasons(reading);
        const expected =
          reasons.length === 0
            ? "healthy"
            : reasons.map((reason) => REASON_HEALTH[reason]).reduce(worstHealth);
        expect(classifyScopeCreep(reading)).toBe(expected);
      }
    }
  });

  it("reports at least one reason for every verdict that is not healthy", () => {
    for (const consumedShare of shares) {
      for (const deliveredShare of shares) {
        const reading = readings({ consumedShare, deliveredShare });
        const health = classifyScopeCreep(reading);
        if (health === null || health === "healthy") continue;
        expect(creepReasons(reading).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("assessScopeCreep", () => {
  it("assesses a project tracking its budget", () => {
    expect(assessScopeCreep(readings())).toEqual({
      health: "healthy",
      reasons: [],
      blindSpots: [],
      consumedShare: 0.5,
      deliveredShare: 0.5,
      gap: 0,
    });
  });

  it("assesses high burn against low completion", () => {
    expect(
      assessScopeCreep(readings({ consumedShare: 0.6, deliveredShare: 0.1 })),
    ).toEqual({
      health: "over",
      reasons: ["burn-far-ahead-of-delivery"],
      blindSpots: [],
      consumedShare: 0.6,
      deliveredShare: 0.1,
      gap: 0.5,
    });
  });

  it("assesses a project past its contract on both axes", () => {
    expect(
      assessScopeCreep(readings({ consumedShare: 1.5, deliveredShare: 0.25 })),
    ).toEqual({
      health: "over",
      reasons: ["contract-overspent", "burn-far-ahead-of-delivery"],
      blindSpots: [],
      consumedShare: 1.5,
      deliveredShare: 0.25,
      gap: 1.25,
    });
  });
});
