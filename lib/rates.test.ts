import { describe, expect, it } from "vitest";

import {
  burnedCents,
  clientRate,
  hasRate,
  isNegativeRate,
  projectRate,
  resolveJoinedRate,
  resolveRate,
  UNRATED,
} from "./rates";

describe("projectRate", () => {
  it("takes the override as the rate, and says the project set it", () => {
    expect(projectRate({ rateCents: 15000 })).toEqual({
      cents: 15000,
      source: "project",
    });
  });

  it("defers to the client when there is no override", () => {
    expect(projectRate({ rateCents: null })).toBeNull();
  });

  it("reads an override of zero as a decision, not as a missing one", () => {
    expect(projectRate({ rateCents: 0 })).toEqual({
      cents: 0,
      source: "project",
    });
  });

  it("carries an override below zero rather than repairing it", () => {
    expect(projectRate({ rateCents: -15000 })).toEqual({
      cents: -15000,
      source: "project",
    });
  });
});

describe("clientRate", () => {
  it("takes the default as the rate, and says the client set it", () => {
    expect(clientRate({ defaultRateCents: 12500 })).toEqual({
      cents: 12500,
      source: "client",
    });
  });

  it("reads a default of zero as nobody having set one", () => {
    expect(clientRate({ defaultRateCents: 0 })).toBeNull();
  });

  it("answers nothing for a project read without its client", () => {
    expect(clientRate(null)).toBeNull();
  });

  it("carries a default below zero rather than repairing it", () => {
    expect(clientRate({ defaultRateCents: -12500 })).toEqual({
      cents: -12500,
      source: "client",
    });
  });
});

describe("resolveRate", () => {
  it("prefers the project's override to the client's default", () => {
    expect(
      resolveRate({ rateCents: 20000 }, { defaultRateCents: 12500 }),
    ).toEqual({ cents: 20000, source: "project" });
  });

  it("falls back to the client's default with no override", () => {
    expect(
      resolveRate({ rateCents: null }, { defaultRateCents: 12500 }),
    ).toEqual({ cents: 12500, source: "client" });
  });

  it("lets an override of nothing beat a client who bills plenty", () => {
    expect(resolveRate({ rateCents: 0 }, { defaultRateCents: 12500 })).toEqual({
      cents: 0,
      source: "project",
    });
  });

  it("keeps a project overridden to nothing apart from an unpriced one", () => {
    const overridden = resolveRate({ rateCents: 0 }, { defaultRateCents: 0 });
    const unpriced = resolveRate({ rateCents: null }, { defaultRateCents: 0 });
    expect(overridden.cents).toBe(unpriced.cents);
    expect(overridden.source).not.toBe(unpriced.source);
  });

  it("comes to nothing when neither row sets a rate", () => {
    expect(resolveRate({ rateCents: null }, { defaultRateCents: 0 })).toEqual(
      UNRATED,
    );
    expect(resolveRate({ rateCents: null }, null)).toEqual(UNRATED);
  });
});

describe("hasRate", () => {
  it("accepts a rate there is money in", () => {
    expect(hasRate({ cents: 1, source: "client" })).toBe(true);
    expect(hasRate({ cents: 15000, source: "project" })).toBe(true);
  });

  it("refuses a rate of nothing, however it was arrived at", () => {
    expect(hasRate(UNRATED)).toBe(false);
    expect(hasRate({ cents: 0, source: "project" })).toBe(false);
  });

  it("refuses a rate below zero rather than billing backwards", () => {
    expect(hasRate({ cents: -15000, source: "project" })).toBe(false);
  });
});

describe("isNegativeRate", () => {
  it("picks out the rate that bills backwards", () => {
    expect(isNegativeRate({ cents: -1, source: "client" })).toBe(true);
  });

  it("leaves a rate of nothing to hasRate to explain", () => {
    expect(isNegativeRate(UNRATED)).toBe(false);
    expect(isNegativeRate({ cents: 0, source: "project" })).toBe(false);
  });

  it("says nothing about a rate that bills", () => {
    expect(isNegativeRate({ cents: 15000, source: "project" })).toBe(false);
  });
});

describe("burnedCents", () => {
  const rate = { cents: 15000, source: "project" } as const;

  it("burns a whole hour at the rate", () => {
    expect(burnedCents(60, rate)).toBe(15000);
  });

  it("burns part of an hour in proportion", () => {
    expect(burnedCents(30, rate)).toBe(7500);
    expect(burnedCents(90, rate)).toBe(22500);
  });

  it("burns a day of work at the rate", () => {
    expect(burnedCents(480, rate)).toBe(120000);
  });

  it("burns nothing for no time at all", () => {
    expect(burnedCents(0, rate)).toBe(0);
  });

  it("rounds a third of an hour to the nearest cent", () => {
    expect(burnedCents(20, { cents: 10000, source: "client" })).toBe(3333);
    expect(burnedCents(20, { cents: 10001, source: "client" })).toBe(3334);
  });

  it("adds up the minutes, not the rounded amounts", () => {
    const third = { cents: 10000, source: "client" } as const;
    const separately = 3 * burnedCents(20, third);
    expect(separately).toBe(9999);
    expect(burnedCents(60, third)).toBe(10000);
  });
});

describe("burnedCents with nothing to bill at", () => {
  it("burns nothing however long the work took", () => {
    expect(burnedCents(4800, UNRATED)).toBe(0);
    expect(burnedCents(4800, { cents: 0, source: "project" })).toBe(0);
  });

  it("is the figure hasRate exists to caveat", () => {
    const rate = UNRATED;
    expect(burnedCents(4800, rate)).toBe(0);
    expect(hasRate(rate)).toBe(false);
  });

  it("keeps the sign off a corrected entry at no rate", () => {
    expect(Object.is(burnedCents(-30, UNRATED), 0)).toBe(true);
  });
});

describe("burnedCents on a hand-edited row", () => {
  it("burns backwards at a negative rate rather than hiding it", () => {
    expect(burnedCents(60, { cents: -15000, source: "project" })).toBe(-15000);
  });

  it("burns backwards for minutes below zero", () => {
    expect(burnedCents(-60, { cents: 15000, source: "project" })).toBe(-15000);
  });

  it("does not let two wrong signs cancel into a plausible figure", () => {
    const backwards = { cents: -15000, source: "project" } as const;
    expect(burnedCents(-60, backwards)).toBe(15000);
    expect(isNegativeRate(backwards)).toBe(true);
  });

  it("rounds an exact half cent of burn upwards", () => {
    expect(burnedCents(11, { cents: 2250, source: "client" })).toBe(413);
  });

  it("rounds a fractional minute to the cent", () => {
    const rate = { cents: 15000, source: "project" } as const;
    expect(burnedCents(30.5, rate)).toBe(7625);
    expect(burnedCents(0.001, rate)).toBe(0);
  });
});

describe("resolving and burning together", () => {
  const minutes = 20 * 60;

  it("burns a project's own override", () => {
    const rate = resolveRate({ rateCents: 20000 }, { defaultRateCents: 12500 });
    expect(burnedCents(minutes, rate)).toBe(4_000_00);
  });

  it("burns an inheriting project at its client's default", () => {
    const rate = resolveRate({ rateCents: null }, { defaultRateCents: 12500 });
    expect(burnedCents(minutes, rate)).toBe(2_500_00);
  });

  it("burns an unpriced project at nothing, and says why", () => {
    const rate = resolveRate({ rateCents: null }, { defaultRateCents: 0 });
    expect(burnedCents(minutes, rate)).toBe(0);
    expect(rate.source).toBe("none");
    expect(hasRate(rate)).toBe(false);
  });

  it("does not bill an inheriting project at its own NULL", () => {
    const inheriting = resolveRate(
      { rateCents: null },
      { defaultRateCents: 12500 },
    );
    const unpriced = resolveRate({ rateCents: null }, { defaultRateCents: 0 });
    expect(burnedCents(minutes, inheriting)).toBeGreaterThan(
      burnedCents(minutes, unpriced),
    );
  });
});

describe("resolveJoinedRate", () => {
  it("takes the project's override off a joined row", () => {
    expect(
      resolveJoinedRate({ rateCents: 15_000, clientDefaultRateCents: 18_000 }),
    ).toEqual({ cents: 15_000, source: "project" });
  });

  it("falls through to the client's default on the same row", () => {
    expect(
      resolveJoinedRate({ rateCents: null, clientDefaultRateCents: 18_000 }),
    ).toEqual({ cents: 18_000, source: "client" });
  });

  it("is unrated when neither half of the row says anything", () => {
    expect(
      resolveJoinedRate({ rateCents: null, clientDefaultRateCents: 0 }),
    ).toBe(UNRATED);
  });

  it("keeps an override of nothing from reaching the client's default", () => {
    expect(
      resolveJoinedRate({ rateCents: 0, clientDefaultRateCents: 18_000 }),
    ).toEqual({ cents: 0, source: "project" });
  });
});
