import { describe, expect, it } from "vitest";

import type { ScopeLine } from "@/lib/scope";
import { NO_THRESHOLD_OVERRIDES } from "@/lib/thresholds/resolve";
import type { LoggedTotals } from "@/lib/time/rollup";

import { portfolioRow, type HealthProject } from "./row";

/**
 * A $10,000 engagement billing at $100 an hour, with nothing configured — so
 * every verdict below is reached at the app's own thresholds.
 */
const PROJECT: HealthProject = {
  id: "prj_1",
  name: "Site rebuild",
  clientId: "cli_1",
  clientName: "Harbour Co",
  clientArchivedAt: null,
  contractValueCents: 1_000_000,
  rateCents: 10_000,
  clientDefaultRateCents: 0,
  ...NO_THRESHOLD_OVERRIDES,
  clientThresholds: NO_THRESHOLD_OVERRIDES,
};

/** `hours` hours logged, every minute of it chargeable. */
function logged(hours: number): LoggedTotals {
  return { entryCount: 1, loggedMinutes: hours * 60, billableMinutes: hours * 60 };
}

/** A scope list of `total` equal lines, `done` of them delivered. */
function scope(total: number, done: number): ScopeLine[] {
  return Array.from({ length: total }, (_unused, index) => ({
    estimatedMinutes: 600,
    status: index < done ? ("done" as const) : ("pending" as const),
  }));
}

describe("portfolioRow", () => {
  it("values the hours at the project's own rate", () => {
    const row = portfolioRow(PROJECT, logged(10), scope(4, 2));

    expect(row.burn.burnedCents).toBe(100_000);
    expect(row.burn.rate).toEqual({ cents: 10_000, source: "project" });
  });

  it("falls back to the client's rate when the project has no override", () => {
    const row = portfolioRow(
      { ...PROJECT, rateCents: null, clientDefaultRateCents: 20_000 },
      logged(10),
      scope(4, 2),
    );

    expect(row.burn.burnedCents).toBe(200_000);
    expect(row.burn.rate.source).toBe("client");
  });

  it("measures the burn against the project's contract value", () => {
    const row = portfolioRow(PROJECT, logged(30), scope(4, 1));

    expect(row.burn.consumedShare).toBeCloseTo(0.3);
    expect(row.assessment.consumedShare).toBeCloseTo(0.3);
  });

  it("clears a project tracking its delivery", () => {
    const row = portfolioRow(PROJECT, logged(30), scope(4, 1));

    expect(row.assessment.health).toBe("healthy");
    expect(row.band).toBe("healthy");
  });

  it("flags a burn running far ahead of the work", () => {
    const row = portfolioRow(PROJECT, logged(80), scope(4, 1));

    expect(row.assessment.health).toBe("over");
    expect(row.band).toBe("over");
    expect(row.assessment.reasons).toContain("burn-far-ahead-of-delivery");
  });

  it("flags a contract nearly spent as worth watching", () => {
    const row = portfolioRow(PROJECT, logged(85), scope(4, 3));

    expect(row.band).toBe("watch");
  });

  it("bands a project whose hours no rate values as unassessed", () => {
    const row = portfolioRow(
      { ...PROJECT, rateCents: null, clientDefaultRateCents: 0 },
      logged(80),
      scope(4, 1),
    );

    expect(row.assessment.health).toBeNull();
    expect(row.band).toBe("unassessed");
    expect(row.assessment.blindSpots).toContain("burn-not-valued");
  });

  it("bands a project with no price to measure against as unassessed", () => {
    const row = portfolioRow(
      { ...PROJECT, contractValueCents: 0 },
      logged(80),
      scope(4, 1),
    );

    expect(row.band).toBe("unassessed");
    expect(row.assessment.blindSpots).toContain("no-contract-value");
  });

  it("judges the project by its own threshold when it has one", () => {
    const lenient = portfolioRow(
      { ...PROJECT, nearlySpentPercent: 95 },
      logged(85),
      scope(4, 3),
    );

    expect(lenient.band).toBe("healthy");
  });

  it("judges the project by its client's threshold when it has none", () => {
    const strict = portfolioRow(
      {
        ...PROJECT,
        clientThresholds: {
          ...NO_THRESHOLD_OVERRIDES,
          nearlySpentPercent: 50,
        },
      },
      logged(60),
      scope(4, 3),
    );

    expect(strict.band).toBe("watch");
  });

  it("carries the thresholds the verdict was reached at", () => {
    const row = portfolioRow(
      { ...PROJECT, nearlySpentPercent: 70 },
      logged(75),
      scope(4, 2),
    );

    expect(row.assessment.thresholds.nearlySpentShare).toBeCloseTo(0.7);
  });

  it("hands back the project it was given, unchanged", () => {
    const row = portfolioRow(PROJECT, logged(10), scope(2, 1));

    expect(row.project).toBe(PROJECT);
  });

  it("reads a project with nothing logged as nothing burned", () => {
    const row = portfolioRow(
      PROJECT,
      { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
      [],
    );

    expect(row.burn.burnedCents).toBe(0);
    expect(row.band).toBe("healthy");
  });
});
