import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import { UNRATED, type EffectiveRate } from "@/lib/rates";
import type { LoggedTotals } from "@/lib/time/rollup";

import {
  contractedFigure,
  describeRateBasis,
  describeWriteOff,
  hasBurnToShow,
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
