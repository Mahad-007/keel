import { describe, expect, it } from "vitest";

import {
  CREEP_REASONS,
  SCOPE_HEALTH,
  type CreepAssessment,
  type ScopeHealth,
} from "@/lib/scope-creep";

import {
  creepReasonSentence,
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
