import { describe, expect, it } from "vitest";

import { SCOPE_HEALTH, type ScopeHealth } from "@/lib/scope-creep";

import {
  isFlaggedBand,
  riskBand,
  riskBandRank,
  RISK_BANDS,
  UNASSESSED_BAND,
} from "./band";

describe("riskBand", () => {
  it("passes a verdict straight through", () => {
    for (const health of SCOPE_HEALTH) {
      expect(riskBand(health)).toBe(health);
    }
  });

  it("names a withheld verdict rather than dropping it", () => {
    expect(riskBand(null)).toBe(UNASSESSED_BAND);
  });

  it("answers a band for every verdict the classifier can reach", () => {
    const bands = [...SCOPE_HEALTH, null].map(riskBand);

    expect(bands.every((band) => RISK_BANDS.includes(band))).toBe(true);
  });
});

describe("riskBandRank", () => {
  it("puts an overspent project at the top", () => {
    expect(riskBandRank("over")).toBe(0);
  });

  it("ranks the four bands worst first with no ties", () => {
    const ranks = RISK_BANDS.map(riskBandRank);

    expect(ranks).toEqual([0, 1, 2, 3]);
  });

  it("ranks a withheld verdict above a healthy one", () => {
    expect(riskBandRank(UNASSESSED_BAND)).toBeLessThan(riskBandRank("healthy"));
  });

  it("ranks a withheld verdict below both flagged bands", () => {
    expect(riskBandRank(UNASSESSED_BAND)).toBeGreaterThan(
      riskBandRank("watch"),
    );
    expect(riskBandRank(UNASSESSED_BAND)).toBeGreaterThan(riskBandRank("over"));
  });

  it("ranks over above watch", () => {
    expect(riskBandRank("over")).toBeLessThan(riskBandRank("watch"));
  });
});

describe("isFlaggedBand", () => {
  it("counts the two bands a comparison came out badly in", () => {
    expect(isFlaggedBand("over")).toBe(true);
    expect(isFlaggedBand("watch")).toBe(true);
  });

  it("does not count a healthy project as flagged", () => {
    expect(isFlaggedBand("healthy")).toBe(false);
  });

  it("does not count a withheld verdict as flagged", () => {
    expect(isFlaggedBand(UNASSESSED_BAND)).toBe(false);
  });

  it("agrees with the classifier about which verdicts are findings", () => {
    const flagged = SCOPE_HEALTH.filter((health: ScopeHealth) =>
      isFlaggedBand(riskBand(health)),
    );

    expect(flagged).toEqual(["watch", "over"]);
  });
});
