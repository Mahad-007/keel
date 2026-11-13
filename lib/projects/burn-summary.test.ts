import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { UNRATED, type EffectiveRate } from "@/lib/rates";
import type { LoggedTotals } from "@/lib/time/rollup";

import {
  BURN_NOT_VALUED_LABEL,
  burnedFigure,
  contractedFigure,
  describeBurned,
  describeConsumed,
  describeRateBasis,
  describeRemaining,
  describeWriteOff,
  hasBurnToShow,
  hasPriceToMeasureAgainst,
  hasValuedBurn,
  remainingFigure,
} from "./burn-summary";

/** The common case: a rate set on the project itself. */
const AT_150: EffectiveRate = { cents: 15_000, source: "project" };

/** Logged totals with the chargeable half defaulting to all of it. */
function logged(
  loggedMinutes: number,
  partial: Partial<LoggedTotals> = {},
): LoggedTotals {
  return {
    entryCount: loggedMinutes === 0 ? 0 : 1,
    loggedMinutes,
    billableMinutes: loggedMinutes,
    ...partial,
  };
}

/** A burn over the three things it is made of, so each test varies one. */
function burn(
  loggedMinutes: number,
  contractedCents: number,
  rate: EffectiveRate = AT_150,
  totals: Partial<LoggedTotals> = {},
): BurnSummary {
  return summariseBurn(logged(loggedMinutes, totals), contractedCents, rate);
}

describe("hasBurnToShow", () => {
  it("shows a burn once time has been logged", () => {
    expect(hasBurnToShow(burn(90, 500_000))).toBe(true);
  });

  it("shows the opening state of a priced project with no hours yet", () => {
    expect(hasBurnToShow(burn(0, 500_000))).toBe(true);
  });

  it("shows a burn against no price, which is the overrun worth seeing", () => {
    expect(hasBurnToShow(burn(90, 0))).toBe(true);
  });

  it("stays away from a project with no price and no hours", () => {
    expect(hasBurnToShow(burn(0, 0))).toBe(false);
  });

  it("shows an unrated project that has hours, so the gap can be named", () => {
    expect(hasBurnToShow(burn(90, 0, UNRATED))).toBe(true);
  });
});

describe("contractedFigure", () => {
  it("shows the amount the engagement was agreed for", () => {
    expect(contractedFigure(burn(90, 500_000))).toEqual({
      label: "Contracted",
      value: "$5,000.00",
      note: null,
    });
  });

  it("says a price nobody has filled in is not set, not $0.00", () => {
    const figure = contractedFigure(burn(90, 0));

    expect(figure.value).toBe("Not set");
    expect(figure.note).toMatch(/nothing for the hours to be measured against/);
  });

  it("points at the form rather than leaving the gap unexplained", () => {
    expect(contractedFigure(burn(90, 0)).note).toMatch(/edit form/);
  });

  it("shows a value below zero as the amount it is", () => {
    const figure = contractedFigure(burn(90, -500_000));

    expect(figure.value).toBe("-$5,000.00");
    expect(figure.note).toBeNull();
  });
});

describe("describeRateBasis", () => {
  it("names the project as the authority for its own override", () => {
    expect(describeRateBasis(AT_150)).toBe(
      "$150.00/hr, the rate set on this project",
    );
  });

  it("names the client when the project inherits their default", () => {
    expect(describeRateBasis({ cents: 18_000, source: "client" })).toBe(
      "$180.00/hr, the client's default rate",
    );
  });

  it("leaves the amount out when there is no rate anywhere", () => {
    const clause = describeRateBasis(UNRATED);

    expect(clause).toBe("no rate is set on this project or its client");
    expect(clause).not.toContain("$");
  });

  it("keeps the amount and the authority for an override of nothing", () => {
    expect(describeRateBasis({ cents: 0, source: "project" })).toBe(
      "$0.00/hr, the rate set on this project",
    );
  });
});

describe("describeWriteOff", () => {
  it("says nothing when every logged minute is chargeable", () => {
    expect(describeWriteOff(burn(1_200, 500_000))).toBeNull();
  });

  it("names the hours absorbed and what absorbing them cost", () => {
    const note = describeWriteOff(
      burn(1_200, 500_000, AT_150, { billableMinutes: 900 }),
    );

    expect(note).toContain("5h not chargeable");
    expect(note).toContain("$750.00");
  });

  it("prices the write-off at the rate, not at nothing", () => {
    const note = describeWriteOff(
      burn(
        120,
        500_000,
        { cents: 20_000, source: "client" },
        { billableMinutes: 60 },
      ),
    );

    expect(note).toContain("$200.00");
  });

  it("leaves the amount out when no rate can value the hours", () => {
    const note = describeWriteOff(
      burn(1_200, 500_000, UNRATED, { billableMinutes: 900 }),
    );

    expect(note).toContain("5h not chargeable");
    expect(note).not.toContain("$");
  });
});

describe("burnedFigure", () => {
  it("values the hours and shows the amount", () => {
    const figure = burnedFigure(burn(1_200, 500_000));

    expect(figure.label).toBe("Burned");
    expect(figure.value).toBe("$3,000.00");
  });

  it("says None yet for a project nobody has logged against", () => {
    const figure = burnedFigure(burn(0, 500_000));

    expect(figure.value).toBe("None yet");
    expect(figure.note).toMatch(/Nothing has been logged/);
  });

  it("refuses to price hours at nothing when no rate is set", () => {
    const figure = burnedFigure(burn(4_800, 500_000, UNRATED));

    expect(figure.value).toBe(BURN_NOT_VALUED_LABEL);
    expect(figure.value).not.toContain("$0.00");
  });

  it("asks for hours before it asks for a rate", () => {
    expect(burnedFigure(burn(0, 500_000, UNRATED)).value).toBe("None yet");
  });

  it("shows a deliberate rate of nothing as an amount, not as a gap", () => {
    const figure = burnedFigure(
      burn(1_200, 500_000, { cents: 0, source: "project" }),
    );

    expect(figure.value).toBe("$0.00");
  });
});

describe("describeBurned", () => {
  it("writes out the hours, the entries and the rate behind the figure", () => {
    const note = describeBurned(
      burn(2_400, 500_000, AT_150, { entryCount: 12 }),
    );

    expect(note).toBe(
      "40h across 12 entries, at $150.00/hr, the rate set on this project.",
    );
  });

  it("states the hours even when there is no rate to value them at", () => {
    const note = describeBurned(
      burn(4_800, 500_000, UNRATED, { entryCount: 9 }),
    );

    expect(note).toContain("80h across 9 entries");
    expect(note).toContain("no rate is set");
  });

  it("adds the write-off as a second sentence, not as a qualification", () => {
    const note = describeBurned(
      burn(1_200, 500_000, AT_150, { billableMinutes: 900 }),
    );

    expect(note).toContain("at $150.00/hr");
    expect(note).toContain("Includes 5h not chargeable");
  });
});

describe("hasPriceToMeasureAgainst", () => {
  it("has a price to compare against once one is agreed", () => {
    expect(hasPriceToMeasureAgainst(burn(1_200, 500_000))).toBe(true);
  });

  it("has none when the contract value is the column's default zero", () => {
    expect(hasPriceToMeasureAgainst(burn(1_200, 0))).toBe(false);
  });

  it("has none when the contract value is below zero", () => {
    expect(hasPriceToMeasureAgainst(burn(1_200, -500_000))).toBe(false);
  });

  it("has a price even before anything has been logged against it", () => {
    expect(hasPriceToMeasureAgainst(burn(0, 500_000))).toBe(true);
  });
});

describe("describeRemaining", () => {
  it("says how much more work the budget pays for", () => {
    expect(describeRemaining(burn(1_200, 500_000))).toBe(
      "About 13h 20m more at $150.00/hr, if the rate holds and nothing more is written off.",
    );
  });

  it("says nothing about the amount, which is the figure above it", () => {
    expect(describeRemaining(burn(1_200, 500_000))).not.toContain("$2,000.00");
  });

  it("gives the exactly-spent contract its own sentence", () => {
    const note = describeRemaining(burn(2_000, 500_000));

    expect(note).toContain("spent to the cent");
    expect(note).not.toContain("$0.00");
  });

  it("repeats the overrun as a positive amount after the word over", () => {
    const note = describeRemaining(burn(3_000, 500_000));

    expect(note).toContain("$2,500.00 over the contract value");
    expect(note).not.toContain("-$");
  });

  it("states the consequence of being over, not just the figure", () => {
    expect(describeRemaining(burn(3_000, 500_000))).toContain(
      "the agreement does not pay for",
    );
  });

  it("has no hours to offer when no rate is set", () => {
    const note = describeRemaining(burn(1_200, 500_000, UNRATED));

    expect(note).toBe(
      "No rate is set, so there is no saying how much more work this pays for.",
    );
  });
});

describe("hasValuedBurn", () => {
  it("is a measurement when a rate valued the hours", () => {
    expect(hasValuedBurn(burn(1_200, 500_000))).toBe(true);
  });

  it("is a gap when hours were logged and no rate could value them", () => {
    expect(hasValuedBurn(burn(1_200, 500_000, UNRATED))).toBe(false);
  });

  it("is a measurement with no hours, whatever the rate situation", () => {
    expect(hasValuedBurn(burn(0, 500_000, UNRATED))).toBe(true);
  });

  it("counts a rate deliberately overridden to nothing as valued", () => {
    expect(
      hasValuedBurn(burn(1_200, 500_000, { cents: 0, source: "project" })),
    ).toBe(true);
  });
});

describe("remainingFigure", () => {
  it("shows what is left of the contract value", () => {
    expect(remainingFigure(burn(1_200, 500_000))).toMatchObject({
      label: "Remaining",
      value: "$2,000.00",
    });
  });

  it("shows the whole contract before anything has been logged", () => {
    expect(remainingFigure(burn(0, 500_000)).value).toBe("$5,000.00");
  });

  it("keeps the minus sign once the project has gone over", () => {
    expect(remainingFigure(burn(3_000, 500_000)).value).toBe("-$2,500.00");
  });

  it("states no amount when the burn could not be priced", () => {
    expect(remainingFigure(burn(1_200, 500_000, UNRATED)).value).toBe(
      BURN_NOT_VALUED_LABEL,
    );
  });

  it("still shows the whole contract when there are no hours to price", () => {
    expect(remainingFigure(burn(0, 500_000, UNRATED)).value).toBe("$5,000.00");
  });
});

describe("describeConsumed", () => {
  it("writes out the two amounts the share was divided from", () => {
    expect(describeConsumed(burn(1_200, 500_000))).toBe(
      "$3,000.00 of the $5,000.00 agreed.",
    );
  });

  it("keeps the working readable past the whole contract", () => {
    expect(describeConsumed(burn(3_000, 500_000))).toBe(
      "$7,500.00 of the $5,000.00 agreed.",
    );
  });

  it("says which half is missing when no rate could value the hours", () => {
    const note = describeConsumed(burn(1_200, 500_000, UNRATED));

    expect(note).toContain("No rate is set");
    expect(note).not.toContain("$0.00");
  });

  it("works out a share of nothing burned against a real price", () => {
    expect(describeConsumed(burn(0, 500_000))).toBe(
      "$0.00 of the $5,000.00 agreed.",
    );
  });
});
