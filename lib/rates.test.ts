import { describe, expect, it } from "vitest";

import {
  clientRate,
  hasRate,
  projectRate,
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
