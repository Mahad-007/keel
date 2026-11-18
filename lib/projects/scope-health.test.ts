import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { UNRATED, type EffectiveRate } from "@/lib/rates";
import {
  CREEP_BLIND_SPOTS,
  CREEP_REASONS,
  SCOPE_HEALTH,
  type CreepAssessment,
  type ScopeHealth,
} from "@/lib/scope-creep";

import { assessProjectCreep } from "./creep-readings";
import {
  BLIND_SPOT_SENTENCE,
  hasScopeHealthToShow,
  NOT_ASSESSED_LEAD,
  scopeHealthBanner,
  describeHealthyProject,
  creepBlindSpotSentences,
  creepReasonSentence,
  creepReasonSentences,
  describeAheadOfDelivery,
  describeBurnAgainstDelivery,
  describeFarAheadOfDelivery,
  describeNearlySpentContract,
  describeOverspentContract,
  formatSharePoints,
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
  scopeHealthHeadline,
} from "./scope-health";

/**
 * An assessment with nothing read, overridden a field at a time.
 *
 * Hand-built rather than classified, because half of what these tests check is
 * what the words do with a figure the classifier would never have left out —
 * the pairings a real project cannot produce are exactly the ones a later
 * caller assembling readings itself could.
 */
function assessment(partial: Partial<CreepAssessment> = {}): CreepAssessment {
  return {
    health: null,
    reasons: [],
    blindSpots: [],
    consumedShare: null,
    deliveredShare: null,
    gap: null,
    ...partial,
  };
}

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

  it("reads the singular off the magnitude, not the figure", () => {
    expect(formatSharePoints(-0.01)).toBe("-1 point");
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

  it("names the unfinished work that earns the flag", () => {
    expect(describeNearlySpentContract(0.84)).toContain(
      "nothing yet says the work is finished",
    );
  });

  it("does not send an unscoped project looking for a list", () => {
    // An empty scope list earns this reason too, and rightly: nobody can say
    // what the remaining fifth of the price has to cover.
    expect(describeNearlySpentContract(0.84)).not.toContain("scope list");
  });

  it("says what the remainder has to cover rather than how much it is", () => {
    const sentence = describeNearlySpentContract(0.84);

    expect(sentence).toContain("whatever is still outstanding");
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

describe("the two shares set against each other", () => {
  it("puts the money first and the work second", () => {
    expect(describeBurnAgainstDelivery(0.6, 0.1)).toBe(
      "60% of the contract has gone on 10% of the estimated work",
    );
  });

  it("says the contract was consumed, not that anyone was paid", () => {
    // The burn is hours at a rate; nothing in Keel knows what was invoiced.
    expect(describeBurnAgainstDelivery(0.6, 0.1)).not.toContain("paid");
  });

  it("does not round a delivered line away to nothing", () => {
    expect(describeBurnAgainstDelivery(0.6, 0.004)).toContain(
      "less than 1% of the estimated work",
    );
  });

  it("reads nothing delivered as nothing", () => {
    expect(describeBurnAgainstDelivery(0.6, 0)).toContain(
      "0% of the estimated work",
    );
  });
});

describe("the sentence for a burn far ahead of its delivery", () => {
  it("quotes both shares and the gap between them", () => {
    const sentence = describeFarAheadOfDelivery(0.6, 0.1, 0.5);

    expect(sentence).toContain("60% of the contract has gone on 10%");
    expect(sentence).toContain("50 points ahead of the delivery");
  });

  it("says why a project with budget left is being flagged", () => {
    expect(describeFarAheadOfDelivery(0.6, 0.1, 0.5)).toContain(
      "both figures look survivable on their own",
    );
  });

  it("does not call both figures survivable once the contract is spent", () => {
    // The reason stacks with contract-overspent, so this sentence lands as a
    // bullet under a lead that has just said the money is gone.
    const sentence = describeFarAheadOfDelivery(1.2, 0.1, 1.1);

    expect(sentence).not.toContain("survivable");
    expect(sentence).toContain("The contract value is already gone");
  });

  it("makes no claim about what the burn will come to", () => {
    const sentence = describeFarAheadOfDelivery(0.6, 0.1, 0.5);

    // A projection rests on the pace holding, and it belongs with the caveats
    // that go with it rather than inside a sentence about today.
    expect(sentence).not.toMatch(/will|expect|project(ed|ion)|forecast/);
  });
});

describe("the sentence for a burn ahead of its delivery", () => {
  it("quotes both shares and the gap between them", () => {
    const sentence = describeAheadOfDelivery(0.45, 0.18, 0.27);

    expect(sentence).toContain("45% of the contract has gone on 18%");
    expect(sentence).toContain("27 points ahead of the delivery");
  });

  it("says the gap is still cheap to close", () => {
    expect(describeAheadOfDelivery(0.45, 0.18, 0.27)).toContain(
      "a conversation rather than a correction",
    );
  });

  it("opens on the same comparison as the far-ahead sentence", () => {
    // The thresholds differ in what follows, not in what is measured. Two
    // spellings of one comparison would read as two different measurements.
    const clause = describeBurnAgainstDelivery(0.6, 0.1);

    expect(describeAheadOfDelivery(0.6, 0.1, 0.5).startsWith(clause)).toBe(true);
    expect(describeFarAheadOfDelivery(0.6, 0.1, 0.5).startsWith(clause)).toBe(
      true,
    );
  });

  it("does not read as the far-ahead sentence", () => {
    expect(describeAheadOfDelivery(0.6, 0.1, 0.5)).not.toBe(
      describeFarAheadOfDelivery(0.6, 0.1, 0.5),
    );
  });
});

describe("one reason's sentence, read off an assessment", () => {
  /** A project 60% consumed against 10% delivered: the creep case. */
  const creeping = assessment({
    consumedShare: 0.6,
    deliveredShare: 0.1,
    gap: 0.5,
  });

  it("has words for every reason the classifier can report", () => {
    for (const reason of CREEP_REASONS) {
      expect(creepReasonSentence(reason, creeping)).not.toBeNull();
    }
  });

  it("gives each reason a sentence of its own", () => {
    const sentences = CREEP_REASONS.map((reason) =>
      creepReasonSentence(reason, creeping),
    );

    expect(new Set(sentences).size).toBe(CREEP_REASONS.length);
  });

  it("quotes the share the verdict was reached from", () => {
    expect(creepReasonSentence("contract-overspent", creeping)).toBe(
      describeOverspentContract(0.6),
    );
  });

  it("quotes the gap the assessment carries rather than subtracting again", () => {
    // A gap the assessment refused is not reconstructed here: the sentence
    // takes the figure the verdict used, whatever the two shares look like.
    const sentence = creepReasonSentence(
      "burn-far-ahead-of-delivery",
      assessment({ consumedShare: 0.9, deliveredShare: 0.1, gap: 0.5 }),
    );

    expect(sentence).toContain("50 points ahead");
  });

  it("has nothing to say about a money reason with no share", () => {
    expect(creepReasonSentence("contract-overspent", assessment())).toBeNull();
  });

  it("has nothing to say about a gap reason with no gap", () => {
    const withoutGap = assessment({ consumedShare: 0.6, deliveredShare: 0.1 });

    expect(creepReasonSentence("burn-ahead-of-delivery", withoutGap)).toBeNull();
  });
});

describe("every reason a project was flagged for", () => {
  it("keeps the classifier's worst-first order", () => {
    const sentences = creepReasonSentences(
      assessment({
        reasons: ["contract-overspent", "burn-ahead-of-delivery"],
        consumedShare: 1.1,
        deliveredShare: 0.8,
        gap: 0.3,
      }),
    );

    expect(sentences).toEqual([
      describeOverspentContract(1.1),
      describeAheadOfDelivery(1.1, 0.8, 0.3),
    ]);
  });

  it("says nothing at all about a project with nothing wrong", () => {
    expect(
      creepReasonSentences(assessment({ health: "healthy", consumedShare: 0.2 })),
    ).toEqual([]);
  });

  it("drops a reason whose figures are missing rather than printing a hole", () => {
    const sentences = creepReasonSentences(
      assessment({
        reasons: ["contract-overspent", "burn-far-ahead-of-delivery"],
        consumedShare: 1.1,
      }),
    );

    expect(sentences).toEqual([describeOverspentContract(1.1)]);
  });
});

describe("the sentences for what a verdict could not see", () => {
  it("has words for every blind spot the classifier can report", () => {
    for (const spot of CREEP_BLIND_SPOTS) {
      expect(BLIND_SPOT_SENTENCE[spot]).toBeTruthy();
    }
  });

  it("gives each blind spot a sentence of its own", () => {
    const sentences = CREEP_BLIND_SPOTS.map((spot) => BLIND_SPOT_SENTENCE[spot]);

    expect(new Set(sentences).size).toBe(CREEP_BLIND_SPOTS.length);
  });

  it("says the verdict is withheld for each of the money gaps", () => {
    // These three take the only axis there is, so the classifier returns null
    // rather than healthy — and the sentence has to say so, or a reader will
    // read the missing verdict as a project doing fine.
    for (const spot of [
      "no-contract-value",
      "burn-not-valued",
      "burn-below-zero",
    ] as const) {
      expect(BLIND_SPOT_SENTENCE[spot]).toMatch(
        /no verdict here at all|verdict is withheld/,
      );
    }
  });

  it("does not claim a verdict stands when a scope gap is reported", () => {
    // A scope gap stacks with a money gap, and a project can have no price and
    // no estimates — so a sentence saying the verdict rests on the money alone
    // would be claiming a verdict that is not there.
    for (const spot of [
      "scope-not-estimated",
      "scope-estimates-invalid",
      "scope-partly-estimated",
      "scope-delivery-unsized",
      "scope-too-coarse",
    ] as const) {
      expect(BLIND_SPOT_SENTENCE[spot]).not.toContain("verdict");
    }
  });

  it("does not send an unscoped project to estimate an empty list", () => {
    // The gap is reported for a list with no estimates and for no list at all,
    // so the fix has to name the list as well as the estimates.
    expect(BLIND_SPOT_SENTENCE["scope-not-estimated"]).toContain(
      "the list and its estimates",
    );
  });

  it("names a form to open for each gap somebody can fix", () => {
    for (const spot of [
      "no-contract-value",
      "burn-not-valued",
      "scope-not-estimated",
      "scope-delivery-unsized",
    ] as const) {
      expect(BLIND_SPOT_SENTENCE[spot]).toMatch(
        /edit form|Scope tab|on its client/,
      );
    }
  });

  it("says a hand-edited row was hand-edited", () => {
    // Neither is reachable through a form, so a reader has to be told the cause
    // is a row rather than a fault in the page.
    for (const spot of ["burn-below-zero", "scope-estimates-invalid"] as const) {
      expect(BLIND_SPOT_SENTENCE[spot]).toContain("edited directly");
    }
  });
});

describe("every gap a verdict was reached around", () => {
  it("keeps the classifier's money-first order", () => {
    const sentences = creepBlindSpotSentences(
      assessment({
        blindSpots: ["no-contract-value", "scope-not-estimated"],
      }),
    );

    expect(sentences).toEqual([
      BLIND_SPOT_SENTENCE["no-contract-value"],
      BLIND_SPOT_SENTENCE["scope-not-estimated"],
    ]);
  });

  it("says nothing about a project with a price, a rate and estimates", () => {
    expect(creepBlindSpotSentences(assessment({ health: "healthy" }))).toEqual(
      [],
    );
  });
});

describe("the sentence for a project with nothing wrong", () => {
  it("quotes both shares rather than saying it is fine", () => {
    const sentence = describeHealthyProject(
      assessment({ health: "healthy", consumedShare: 0.42, deliveredShare: 0.5 }),
    );

    expect(sentence).toContain(describeBurnAgainstDelivery(0.42, 0.5));
    expect(sentence).toContain("inside the price agreed");
  });

  it("says the delivery was not read when there was no share for it", () => {
    const sentence = describeHealthyProject(
      assessment({ health: "healthy", consumedShare: 0.42 }),
    );

    expect(sentence).toContain("42% of the contract has gone");
    expect(sentence).toContain("this is the money on its own");
  });

  it("clears a project that delivered everything inside its price", () => {
    const sentence = describeHealthyProject(
      assessment({ health: "healthy", consumedShare: 0.84, deliveredShare: 1 }),
    );

    expect(sentence).toContain("84% of the contract has gone on 100%");
  });
});

describe("the banner for one project", () => {
  it("leads with the worst reason and keeps the rest under it", () => {
    const banner = scopeHealthBanner(
      assessment({
        health: "over",
        reasons: ["contract-overspent", "burn-ahead-of-delivery"],
        consumedShare: 1.1,
        deliveredShare: 0.8,
        gap: 0.3,
      }),
    );

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toBe(describeOverspentContract(1.1));
    expect(banner.reasons).toEqual([describeAheadOfDelivery(1.1, 0.8, 0.3)]);
  });

  it("explains a healthy project rather than leaving the sentence empty", () => {
    const banner = scopeHealthBanner(
      assessment({ health: "healthy", consumedShare: 0.42, deliveredShare: 0.5 }),
    );

    expect(banner.headline).toBe("On track");
    expect(banner.verdict).toBe(
      describeHealthyProject(
        assessment({ health: "healthy", consumedShare: 0.42, deliveredShare: 0.5 }),
      ),
    );
    expect(banner.reasons).toEqual([]);
  });

  it("does not blame the burn for a verdict a missing price withheld", () => {
    // The burn panel below prints the burn in full; a lead sentence saying it
    // could not be read would have the banner contradicting the figures.
    expect(NOT_ASSESSED_LEAD).not.toContain("the burn could not be read");
    expect(NOT_ASSESSED_LEAD).toContain("no readable share of the contract");
  });

  it("does not let a withheld verdict read as a healthy one", () => {
    const banner = scopeHealthBanner(
      assessment({ blindSpots: ["burn-not-valued"] }),
    );

    expect(banner.headline).toBe("Not assessed");
    expect(banner.verdict).toBe(NOT_ASSESSED_LEAD);
    expect(banner.gaps).toEqual([BLIND_SPOT_SENTENCE["burn-not-valued"]]);
  });

  it("never clears a flagged project it could not explain", () => {
    // Not reachable from assessScopeCreep — a verdict is the worst of its
    // reasons — but reachable from a caller assembling an assessment itself,
    // and a banner that clears a flagged project is wrong about the only thing
    // that matters.
    const banner = scopeHealthBanner(assessment({ health: "over" }));

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toContain("This project is flagged");
    expect(banner.verdict).not.toContain("came out fine");
  });

  it("always has a sentence under the heading", () => {
    for (const health of [null, ...SCOPE_HEALTH]) {
      const banner = scopeHealthBanner(assessment({ health }));

      expect(banner.verdict.length).toBeGreaterThan(0);
    }
  });

  it("carries the verdict through for the component's tone", () => {
    expect(scopeHealthBanner(assessment({ health: "watch" })).health).toBe(
      "watch",
    );
    expect(scopeHealthBanner(assessment()).health).toBeNull();
  });
});

/** A burn summary as the overview panel builds one. */
function burn(
  loggedMinutes: number,
  contractedCents: number,
  rate: EffectiveRate = { cents: 20_000, source: "project" },
): BurnSummary {
  return summariseBurn(
    {
      entryCount: loggedMinutes === 0 ? 0 : 1,
      loggedMinutes,
      billableMinutes: loggedMinutes,
    },
    contractedCents,
    rate,
  );
}

describe("whether a project is far enough along for a banner", () => {
  it("stays off a row nobody has priced, logged against or scoped", () => {
    expect(hasScopeHealthToShow(burn(0, 0), 0)).toBe(false);
  });

  it("shows once a price has been agreed", () => {
    expect(hasScopeHealthToShow(burn(0, 1_000_000), 0)).toBe(true);
  });

  it("shows once an hour has been logged, even with no price", () => {
    expect(hasScopeHealthToShow(burn(60, 0), 0)).toBe(true);
  });

  it("shows once a line of scope has been written down", () => {
    expect(hasScopeHealthToShow(burn(0, 0), 1)).toBe(true);
  });

  it("shows for the project with unpriced hours and nothing else", () => {
    // The dangerous row: hours gone in, no rate, no price. The verdict is
    // withheld, and the banner is the only thing that says so.
    expect(hasScopeHealthToShow(burn(4_800, 0, UNRATED), 0)).toBe(true);
  });
});

describe("the banner over a burn and a scope list", () => {
  /** One scope line, pending unless its status says otherwise. */
  function line(
    estimatedMinutes: number,
    status: "pending" | "started" | "done" = "pending",
  ) {
    return { estimatedMinutes, status };
  }

  it("explains the case the phase was built for", () => {
    // $6,000 of a $10,000 contract, fifty hours estimated, nothing done.
    const banner = scopeHealthBanner(
      assessProjectCreep(burn(1_800, 1_000_000), [
        line(300),
        line(2_400),
        line(300),
      ]),
    );

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toContain(
      "60% of the contract has gone on 0% of the estimated work",
    );
    expect(banner.verdict).toContain("60 points ahead of the delivery");
    expect(banner.gaps).toEqual([]);
  });

  it("clears a project whose money is tracking its delivery", () => {
    const banner = scopeHealthBanner(
      assessProjectCreep(burn(1_800, 1_000_000), [
        line(1_800, "done"),
        line(1_200),
      ]),
    );

    expect(banner.headline).toBe("On track");
    expect(banner.verdict).toContain("60% of the contract has gone on 60%");
    expect(banner.reasons).toEqual([]);
  });

  it("withholds a verdict from unpriced hours and says which form to open", () => {
    const banner = scopeHealthBanner(
      assessProjectCreep(burn(4_800, 1_000_000, UNRATED), [
        line(1_800),
        line(600),
      ]),
    );

    expect(banner.headline).toBe("Not assessed");
    expect(banner.verdict).toBe(NOT_ASSESSED_LEAD);
    expect(banner.gaps).toEqual([BLIND_SPOT_SENTENCE["burn-not-valued"]]);
  });

  it("reads the money axis alone when nothing was estimated", () => {
    const banner = scopeHealthBanner(
      assessProjectCreep(burn(3_300, 1_000_000), [line(0), line(0)]),
    );

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toContain("110% of the contract value");
    expect(banner.gaps).toEqual([
      BLIND_SPOT_SENTENCE["scope-not-estimated"],
    ]);
  });
});
