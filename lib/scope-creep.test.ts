import { describe, expect, it } from "vitest";

import {
  AHEAD_OF_DELIVERY_GAP,
  assessScopeCreep,
  classifyConsumedShare,
  classifyCreepGap,
  classifyScopeCreep,
  CREEP_BLIND_SPOTS,
  creepBlindSpots,
  creepGap,
  CREEP_REASONS,
  creepReasons,
  type CreepReadings,
  FAR_AHEAD_OF_DELIVERY_GAP,
  healthSeverity,
  NEARLY_SPENT_SHARE,
  OVERSPENT_SHARE,
  readConsumedShare,
  readCreepGap,
  deliveredShareBlindSpot,
  readDeliveredShare,
  REASON_HEALTH,
  SCOPE_HEALTH,
  type ScopeHealth,
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
    lineCount: 4,
    unestimatedCount: 0,
    negativeEstimateCount: 0,
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
      ["contract-overspent"],
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

  it("says the overspend once rather than as a gap as well", () => {
    expect(
      creepReasons(
        readings({
          consumedShare: 1.6,
          deliveredShare: 1,
          scopeDelivered: true,
        }),
      ),
    ).toEqual(["contract-overspent"]);
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
      classifyScopeCreep(
        readings({ consumedShare: 0.85, deliveredShare: 0.8 }),
      ),
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
      classifyScopeCreep(
        readings({ consumedShare: 0.45, deliveredShare: 0.2 }),
      ),
    ).toBe("watch");
  });

  it("is healthy on a project delivered inside its budget", () => {
    expect(
      classifyScopeCreep(
        readings({
          consumedShare: 0.9,
          deliveredShare: 1,
          scopeDelivered: true,
        }),
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
      classifyScopeCreep(
        readings({ consumedShare: 1.4, deliveredShare: null }),
      ),
    ).toBe("over");
  });

  it("still says a contract is nearly spent with nothing estimated", () => {
    expect(
      classifyScopeCreep(
        readings({ consumedShare: 0.9, deliveredShare: null }),
      ),
    ).toBe("watch");
  });

  it("is healthy on an unestimated project with plenty of budget left", () => {
    expect(
      classifyScopeCreep(
        readings({ consumedShare: 0.2, deliveredShare: null }),
      ),
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
            : reasons
                .map((reason) => REASON_HEALTH[reason])
                .reduce(worstHealth);
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

describe("assessScopeCreep where something is missing", () => {
  it("withholds every figure that depends on a price", () => {
    expect(assessScopeCreep(readings({ consumedShare: null }))).toEqual({
      health: null,
      reasons: [],
      blindSpots: ["no-contract-value"],
      consumedShare: null,
      deliveredShare: 0.5,
      gap: null,
    });
  });

  it("withholds the share an unvalued burn would have divided out to", () => {
    expect(
      assessScopeCreep(readings({ consumedShare: 0, burnValued: false })),
    ).toEqual({
      health: null,
      reasons: [],
      blindSpots: ["burn-not-valued"],
      consumedShare: null,
      deliveredShare: 0.5,
      gap: null,
    });
  });

  it("keeps the money axis when nothing has been estimated", () => {
    expect(
      assessScopeCreep(readings({ consumedShare: 0.9, deliveredShare: null })),
    ).toEqual({
      health: "watch",
      reasons: ["contract-nearly-spent"],
      blindSpots: ["scope-not-estimated"],
      consumedShare: 0.9,
      deliveredShare: null,
      gap: null,
    });
  });

  it("assesses a project delivered inside its budget as healthy", () => {
    expect(
      assessScopeCreep(
        readings({
          consumedShare: 0.875,
          deliveredShare: 1,
          scopeDelivered: true,
        }),
      ),
    ).toEqual({
      health: "healthy",
      reasons: [],
      blindSpots: [],
      consumedShare: 0.875,
      deliveredShare: 1,
      gap: null,
    });
  });
});

/**
 * The verdicts in worsening order, for the monotonicity properties below. A
 * verdict can only be compared with another through `healthSeverity`, and a
 * withheld verdict has no place in the order at all — so these walks skip the
 * readings that produce one, which are tested by name above.
 */
describe("classifyScopeCreep as the burn grows", () => {
  const shares = [0, 0.1, 0.25, 0.5, 0.75, 0.79, 0.8, 0.9, 1, 1.25, 2];

  it("never improves a verdict by burning more of the contract", () => {
    for (const deliveredShare of [0, 0.25, 0.5, 0.75, 1]) {
      let worst = 0;
      for (const consumedShare of shares) {
        const health = classifyScopeCreep(
          readings({ consumedShare, deliveredShare }),
        );
        expect(health).not.toBeNull();
        const severity = healthSeverity(health as ScopeHealth);
        expect(severity).toBeGreaterThanOrEqual(worst);
        worst = severity;
      }
    }
  });

  it("never improves a verdict with nothing estimated either", () => {
    let worst = 0;
    for (const consumedShare of shares) {
      const health = classifyScopeCreep(
        readings({ consumedShare, deliveredShare: null }),
      );
      const severity = healthSeverity(health as ScopeHealth);
      expect(severity).toBeGreaterThanOrEqual(worst);
      worst = severity;
    }
  });
});

describe("classifyScopeCreep as the work gets delivered", () => {
  const shares = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

  it("never worsens a verdict by delivering more of the work", () => {
    for (const consumedShare of [0.2, 0.5, 0.75, 0.85, 1.2]) {
      let worst = healthSeverity("over");
      for (const deliveredShare of shares) {
        const health = classifyScopeCreep(
          readings({ consumedShare, deliveredShare }),
        );
        const severity = healthSeverity(health as ScopeHealth);
        expect(severity).toBeLessThanOrEqual(worst);
        worst = severity;
      }
    }
  });

  it("clears a watch on a nearly spent contract once the list is done", () => {
    const halfway = readings({ consumedShare: 0.9, deliveredShare: 0.9 });
    expect(classifyScopeCreep(halfway)).toBe("watch");
    expect(
      classifyScopeCreep({
        ...halfway,
        deliveredShare: 1,
        scopeDelivered: true,
      }),
    ).toBe("healthy");
  });
});

/**
 * The verdicts read as a table of projects somebody might actually have, which
 * is the one test here that can be checked against intuition rather than
 * against the thresholds. If a row of this ever reads wrong, the thresholds are
 * wrong — not the row.
 */
describe("classifyScopeCreep over projects somebody might have", () => {
  const projects: ReadonlyArray<{
    readonly name: string;
    readonly consumedShare: number;
    readonly deliveredShare: number;
    readonly health: ScopeHealth;
  }> = [
    {
      name: "just started",
      consumedShare: 0.05,
      deliveredShare: 0,
      health: "healthy",
    },
    {
      name: "halfway, in step",
      consumedShare: 0.5,
      deliveredShare: 0.5,
      health: "healthy",
    },
    {
      name: "two thirds spent, half done",
      consumedShare: 0.66,
      deliveredShare: 0.5,
      health: "healthy",
    },
    {
      name: "a third spent, nothing shippable",
      consumedShare: 0.3,
      deliveredShare: 0,
      health: "watch",
    },
    {
      name: "half spent, nothing shippable",
      consumedShare: 0.5,
      deliveredShare: 0,
      health: "over",
    },
    {
      name: "most spent, a tenth done",
      consumedShare: 0.6,
      deliveredShare: 0.1,
      health: "over",
    },
    {
      name: "nearly spent, nearly done",
      consumedShare: 0.9,
      deliveredShare: 0.85,
      health: "watch",
    },
    {
      name: "spent to the cent, all done",
      consumedShare: 1,
      deliveredShare: 1,
      health: "over",
    },
    {
      name: "two thirds over",
      consumedShare: 1.68,
      deliveredShare: 0.9,
      health: "over",
    },
  ];

  for (const project of projects) {
    it(`calls a project ${project.name} ${project.health}`, () => {
      expect(
        classifyScopeCreep(
          readings({
            consumedShare: project.consumedShare,
            deliveredShare: project.deliveredShare,
          }),
        ),
      ).toBe(project.health);
    });
  }
});

describe("readDeliveredShare", () => {
  it("passes an ordinary share straight through", () => {
    expect(readDeliveredShare(readings({ deliveredShare: 0.4 }))).toBe(0.4);
  });

  it("keeps nothing delivered, which is where every project starts", () => {
    expect(readDeliveredShare(readings({ deliveredShare: 0 }))).toBe(0);
  });

  it("keeps everything delivered", () => {
    expect(readDeliveredShare(readings({ deliveredShare: 1 }))).toBe(1);
  });

  it("has no share with nothing estimated", () => {
    expect(readDeliveredShare(readings({ deliveredShare: null }))).toBeNull();
  });

  it("refuses more than everything delivered", () => {
    expect(readDeliveredShare(readings({ deliveredShare: 1.4 }))).toBeNull();
  });

  it("refuses a share below nothing", () => {
    expect(readDeliveredShare(readings({ deliveredShare: -0.2 }))).toBeNull();
  });
});

describe("a project whose estimates put the delivered share out of range", () => {
  /** 90% of the budget gone, and a scope list claiming 140% delivered. */
  const edited = readings({ consumedShare: 0.9, deliveredShare: 1.4 });

  it("does not let the bad share subtract the warning away", () => {
    expect(classifyScopeCreep(edited)).toBe("watch");
    expect(creepReasons(edited)).toEqual(["contract-nearly-spent"]);
  });

  it("says which list to go and look at", () => {
    expect(creepBlindSpots(edited)).toEqual(["scope-estimates-invalid"]);
  });

  it("carries no delivered share and no gap", () => {
    expect(assessScopeCreep(edited).deliveredShare).toBeNull();
    expect(assessScopeCreep(edited).gap).toBeNull();
  });

  it("does not flag a project on a delivered share below nothing", () => {
    const negative = readings({ consumedShare: 0.3, deliveredShare: -0.5 });
    expect(creepReasons(negative)).toEqual([]);
    expect(creepBlindSpots(negative)).toEqual(["scope-estimates-invalid"]);
  });

  it("keeps the money axis when the estimates are the only thing wrong", () => {
    const over = readings({ consumedShare: 1.2, deliveredShare: 1.4 });
    expect(classifyScopeCreep(over)).toBe("over");
    expect(creepReasons(over)).toEqual(["contract-overspent"]);
  });
});

describe("readDeliveredShare over a list with a negative estimate", () => {
  /** Ten hours done, twenty open, and a line of minus four hours. */
  const corrupted = readings({
    deliveredShare: 10 / 16,
    negativeEstimateCount: 1,
  });

  it("refuses a share whose denominator is wrong but whose value is not", () => {
    expect(readDeliveredShare(corrupted)).toBeNull();
  });

  it("names the estimates rather than the share", () => {
    expect(creepBlindSpots(corrupted)).toEqual(["scope-estimates-invalid"]);
  });

  it("leaves the money axis to speak for itself", () => {
    const over = { ...corrupted, consumedShare: 1.1 };
    expect(classifyScopeCreep(over)).toBe("over");
    expect(creepReasons(over)).toEqual(["contract-overspent"]);
  });

  it("does not flag the gap on a share it refused", () => {
    const burning = { ...corrupted, consumedShare: 0.7 };
    expect(creepReasons(burning)).toEqual([]);
    expect(assessScopeCreep(burning).gap).toBeNull();
  });
});

describe("readDeliveredShare over a partly estimated list", () => {
  /** One sized line done, two unsized lines still open. */
  const partly = readings({
    consumedShare: 0.9,
    deliveredShare: 1,
    lineCount: 3,
    unestimatedCount: 2,
    scopeDelivered: false,
  });

  it("refuses a share that only covers the lines somebody sized", () => {
    expect(readDeliveredShare(partly)).toBeNull();
  });

  it("names the half-estimated list", () => {
    expect(deliveredShareBlindSpot(partly)).toBe("scope-partly-estimated");
    expect(creepBlindSpots(partly)).toEqual(["scope-partly-estimated"]);
  });

  it("does not let it claim the project is delivered", () => {
    expect(assessScopeCreep(partly).deliveredShare).toBeNull();
    expect(assessScopeCreep(partly).gap).toBeNull();
  });

  it("still flags the contract it has nearly spent", () => {
    expect(classifyScopeCreep(partly)).toBe("watch");
    expect(creepReasons(partly)).toEqual(["contract-nearly-spent"]);
  });

  it("names the worse of two things wrong with the estimates", () => {
    expect(
      deliveredShareBlindSpot({
        ...partly,
        negativeEstimateCount: 1,
      }),
    ).toBe("scope-estimates-invalid");
  });

  it("finds nothing wrong with a list sized all the way through", () => {
    expect(deliveredShareBlindSpot(readings())).toBeNull();
  });
});

describe("readDeliveredShare over a scope list of one line", () => {
  /** Half the budget gone on the only deliverable there is. */
  const single = readings({
    consumedShare: 0.6,
    deliveredShare: 0,
    lineCount: 1,
    scopeDelivered: false,
  });

  it("refuses a share that is nought by construction", () => {
    expect(readDeliveredShare(single)).toBeNull();
    expect(deliveredShareBlindSpot(single)).toBe("scope-too-coarse");
  });

  it("does not call a one-line project over on its gap alone", () => {
    expect(creepReasons(single)).toEqual([]);
    expect(classifyScopeCreep(single)).toBe("healthy");
  });

  it("still judges a one-line project on its money", () => {
    expect(classifyScopeCreep({ ...single, consumedShare: 1.2 })).toBe("over");
  });

  it("reads the share again once the only line is delivered", () => {
    const done = {
      ...single,
      deliveredShare: 1,
      scopeDelivered: true,
    };
    expect(readDeliveredShare(done)).toBe(1);
    expect(deliveredShareBlindSpot(done)).toBeNull();
  });

  it("reads the share on a list staged in two", () => {
    expect(readDeliveredShare({ ...single, lineCount: 2 })).toBe(0);
  });

  it("says nothing about coarseness when nothing is estimated", () => {
    expect(deliveredShareBlindSpot({ ...single, deliveredShare: null })).toBe(
      "scope-not-estimated",
    );
  });
});

describe("readCreepGap", () => {
  it("is the money ahead of the work while there is work left", () => {
    expect(
      readCreepGap(readings({ consumedShare: 0.6, deliveredShare: 0.1 })),
    ).toBeCloseTo(0.5);
  });

  it("is nothing once every line is delivered", () => {
    expect(
      readCreepGap(
        readings({
          consumedShare: 1.6,
          deliveredShare: 1,
          scopeDelivered: true,
        }),
      ),
    ).toBeNull();
  });

  it("is nothing where the burn could not be valued", () => {
    expect(
      readCreepGap(readings({ consumedShare: 0, burnValued: false })),
    ).toBeNull();
  });

  it("is nothing where the delivered share was refused", () => {
    expect(
      readCreepGap(readings({ deliveredShare: 1, unestimatedCount: 2 })),
    ).toBeNull();
  });

  it("is the figure the assessment carries", () => {
    for (const consumedShare of [0.2, 0.6, 1.2]) {
      for (const deliveredShare of [0, 0.3, 1]) {
        const reading = readings({ consumedShare, deliveredShare });
        expect(assessScopeCreep(reading).gap).toBe(readCreepGap(reading));
      }
    }
  });
});

describe("every code this file can report", () => {
  /** One set of readings per blind spot, each missing exactly that thing. */
  const missing: Record<string, CreepReadings> = {
    "no-contract-value": readings({ consumedShare: null }),
    "burn-not-valued": readings({ consumedShare: 0, burnValued: false }),
    "burn-below-zero": readings({ consumedShare: -0.2 }),
    "scope-not-estimated": readings({ deliveredShare: null }),
    "scope-estimates-invalid": readings({ negativeEstimateCount: 1 }),
    "scope-partly-estimated": readings({ unestimatedCount: 1 }),
    "scope-too-coarse": readings({ lineCount: 1 }),
  };

  it("has a reading that produces each blind spot", () => {
    for (const spot of CREEP_BLIND_SPOTS) {
      expect(creepBlindSpots(missing[spot])).toContain(spot);
    }
  });

  /** One set of readings per reason, each flagged by exactly that comparison. */
  const flagged: Record<string, CreepReadings> = {
    "contract-overspent": readings({ consumedShare: 1.1, deliveredShare: 1 }),
    "burn-far-ahead-of-delivery": readings({
      consumedShare: 0.6,
      deliveredShare: 0,
    }),
    "contract-nearly-spent": readings({
      consumedShare: 0.85,
      deliveredShare: 0.8,
    }),
    "burn-ahead-of-delivery": readings({
      consumedShare: 0.45,
      deliveredShare: 0.15,
    }),
  };

  it("has a reading that produces each reason", () => {
    for (const reason of CREEP_REASONS) {
      expect(creepReasons(flagged[reason])).toContain(reason);
    }
  });

  it("gives every reason a verdict worse than healthy", () => {
    for (const reason of CREEP_REASONS) {
      expect(REASON_HEALTH[reason]).not.toBe("healthy");
    }
  });
});
