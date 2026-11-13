import { describe, expect, it } from "vitest";

import { UNRATED, type EffectiveRate } from "./rates";
import type { LoggedTotals } from "./time/rollup";

import {
  consumedShare,
  overspentCents,
  remainingContractCents,
  summariseBurn,
} from "./burn";

/** A rate set on the project itself, which is the common case in these tests. */
const AT_150: EffectiveRate = { cents: 15_000, source: "project" };

/** Logged totals with the chargeable half defaulting to all of it. */
function logged(
  loggedMinutes: number,
  partial: Partial<LoggedTotals> = {},
): LoggedTotals {
  return {
    entryCount: 1,
    loggedMinutes,
    billableMinutes: loggedMinutes,
    ...partial,
  };
}

describe("remainingContractCents", () => {
  it("takes the burn off the contract value", () => {
    expect(remainingContractCents(500_000, 180_000)).toBe(320_000);
  });

  it("is the whole contract when nothing has been burned", () => {
    expect(remainingContractCents(500_000, 0)).toBe(500_000);
  });

  it("is nothing left when the burn lands exactly on the contract", () => {
    expect(remainingContractCents(500_000, 500_000)).toBe(0);
  });

  it("goes below zero rather than clamping once it is over", () => {
    expect(remainingContractCents(500_000, 840_000)).toBe(-340_000);
  });

  it("reports the whole burn as overspend when no price is set", () => {
    expect(remainingContractCents(0, 120_000)).toBe(-120_000);
  });
});

describe("consumedShare", () => {
  it("is the burn over the contract value", () => {
    expect(consumedShare(500_000, 125_000)).toBe(0.25);
  });

  it("is nothing consumed when nothing has been burned", () => {
    expect(consumedShare(500_000, 0)).toBe(0);
  });

  it("is exactly one when the burn lands on the contract value", () => {
    expect(consumedShare(500_000, 500_000)).toBe(1);
  });

  it("goes past one rather than clamping, which is the point of it", () => {
    expect(consumedShare(500_000, 840_000)).toBe(1.68);
  });

  it("has no share to report when no contract value is set", () => {
    expect(consumedShare(0, 120_000)).toBeNull();
  });

  it("has no share to report when the contract value is below zero", () => {
    expect(consumedShare(-500_000, 120_000)).toBeNull();
  });

  it("leaves the fraction unrounded for the formatter to read", () => {
    expect(consumedShare(300_000, 1_000)).toBeCloseTo(0.003_333, 6);
  });
});

describe("overspentCents", () => {
  it("is how far past the contract value the burn has gone", () => {
    expect(overspentCents(500_000, 840_000)).toBe(340_000);
  });

  it("is nothing while the burn is still inside the contract", () => {
    expect(overspentCents(500_000, 180_000)).toBe(0);
  });

  it("is nothing when the burn lands exactly on the contract", () => {
    expect(overspentCents(500_000, 500_000)).toBe(0);
  });

  it("is one cent over at one cent over, with no rounding to hide it", () => {
    expect(overspentCents(500_000, 500_001)).toBe(1);
  });

  it("reads a burn against no price as entirely overspend", () => {
    expect(overspentCents(0, 120_000)).toBe(120_000);
  });
});

describe("summariseBurn", () => {
  it("values the hours at the rate and sets them against the price", () => {
    const burn = summariseBurn(logged(1_200), 500_000, AT_150);

    expect(burn.burnedCents).toBe(300_000);
    expect(burn.remainingCents).toBe(200_000);
    expect(burn.consumedShare).toBe(0.6);
  });

  it("echoes the price, the rate and the minutes it worked from", () => {
    const burn = summariseBurn(
      logged(90, { entryCount: 3 }),
      500_000,
      AT_150,
    );

    expect(burn).toMatchObject({
      contractedCents: 500_000,
      rate: AT_150,
      entryCount: 3,
      loggedMinutes: 90,
      billableMinutes: 90,
    });
  });

  it("burns nothing for a project nobody has logged against", () => {
    const burn = summariseBurn(logged(0, { entryCount: 0 }), 500_000, AT_150);

    expect(burn.burnedCents).toBe(0);
    expect(burn.remainingCents).toBe(500_000);
    expect(burn.consumedShare).toBe(0);
  });
});

describe("summariseBurn with no rate set anywhere", () => {
  it("burns nothing however many hours went in", () => {
    const burn = summariseBurn(logged(4_800), 500_000, UNRATED);

    expect(burn.burnedCents).toBe(0);
    expect(burn.remainingCents).toBe(500_000);
  });

  it("carries the hours, so the zero can be told from an idle project", () => {
    const burn = summariseBurn(logged(4_800, { entryCount: 40 }), 500_000, UNRATED);

    expect(burn.loggedMinutes).toBe(4_800);
    expect(burn.entryCount).toBe(40);
    expect(burn.rate.source).toBe("none");
  });

  it("reports the whole contract as unconsumed rather than as unknown", () => {
    expect(summariseBurn(logged(4_800), 500_000, UNRATED).consumedShare).toBe(
      0,
    );
  });
});

describe("summariseBurn with no contract value", () => {
  it("has no share to report, rather than reporting everything consumed", () => {
    expect(summariseBurn(logged(1_200), 0, AT_150).consumedShare).toBeNull();
  });

  it("still values the hours, which is the half it does know", () => {
    const burn = summariseBurn(logged(1_200), 0, AT_150);

    expect(burn.burnedCents).toBe(300_000);
    expect(burn.remainingCents).toBe(-300_000);
  });

  it("has no share to report against a price below zero either", () => {
    const burn = summariseBurn(logged(1_200), -500_000, AT_150);

    expect(burn.consumedShare).toBeNull();
    expect(burn.remainingCents).toBe(-800_000);
  });
});

describe("summariseBurn with time written off", () => {
  it("burns every logged minute and charges only the chargeable ones", () => {
    const burn = summariseBurn(
      logged(1_200, { billableMinutes: 900 }),
      500_000,
      AT_150,
    );

    expect(burn.burnedCents).toBe(300_000);
    expect(burn.chargeableCents).toBe(225_000);
  });

  it("does not let a write-off make the project look healthier", () => {
    const charged = summariseBurn(logged(1_200), 500_000, AT_150);
    const absorbed = summariseBurn(
      logged(1_200, { billableMinutes: 0 }),
      500_000,
      AT_150,
    );

    expect(absorbed.burnedCents).toBe(charged.burnedCents);
    expect(absorbed.remainingCents).toBe(charged.remainingCents);
    expect(absorbed.chargeableCents).toBe(0);
  });

  it("charges the whole burn when nothing has been written off", () => {
    const burn = summariseBurn(logged(1_200), 500_000, AT_150);

    expect(burn.chargeableCents).toBe(burn.burnedCents);
  });
});
