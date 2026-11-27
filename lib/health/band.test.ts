import { describe, expect, it } from "vitest";

import { SCOPE_HEALTH, type ScopeHealth } from "@/lib/scope-creep";

import {
  isFlaggedBand,
  riskBand,
  riskBandRank,
  RISK_BANDS,
  UNASSESSED_BAND,
  UNSTARTED_BAND,
} from "./band";

describe("riskBand", () => {
  it("passes a verdict straight through", () => {
    for (const health of SCOPE_HEALTH) {
      expect(riskBand(health, true)).toBe(health);
    }
  });

  it("names a withheld verdict rather than dropping it", () => {
    expect(riskBand(null, true)).toBe(UNASSESSED_BAND);
  });

  it("calls a project with nothing to assess not started", () => {
    expect(riskBand(null, false)).toBe(UNSTARTED_BAND);
  });

  it("lets a verdict win over a project that looks unstarted", () => {
    expect(riskBand("over", false)).toBe("over");
  });

  it("answers a band for every verdict the classifier can reach", () => {
    const bands = [...SCOPE_HEALTH, null].flatMap((health) => [
      riskBand(health, true),
      riskBand(health, false),
    ]);

    expect(bands.every((band) => RISK_BANDS.includes(band))).toBe(true);
  });
});

describe("riskBandRank", () => {
  it("puts an overspent project at the top", () => {
    expect(riskBandRank("over")).toBe(0);
  });

  it("ranks the five bands worst first with no ties", () => {
    const ranks = RISK_BANDS.map(riskBandRank);

    expect(ranks).toEqual([0, 1, 2, 3, 4]);
  });

  it("ranks a withheld verdict above a healthy one", () => {
    expect(riskBandRank(UNASSESSED_BAND)).toBeLessThan(riskBandRank("healthy"));
  });

  it("ranks an engagement that has not begun below a healthy one", () => {
    expect(riskBandRank(UNSTARTED_BAND)).toBeGreaterThan(
      riskBandRank("healthy"),
    );
  });

  it("ranks an unstarted project last of all", () => {
    expect(riskBandRank(UNSTARTED_BAND)).toBe(RISK_BANDS.length - 1);
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

  it("does not count an unstarted project as flagged", () => {
    expect(isFlaggedBand(UNSTARTED_BAND)).toBe(false);
  });

  it("agrees with the classifier about which verdicts are findings", () => {
    const flagged = SCOPE_HEALTH.filter((health: ScopeHealth) =>
      isFlaggedBand(riskBand(health, true)),
    );

    expect(flagged).toEqual(["watch", "over"]);
  });
});
