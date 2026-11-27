import { describe, expect, it } from "vitest";

import { NO_THRESHOLD_OVERRIDES } from "@/lib/thresholds/resolve";
import type { LoggedTotals } from "@/lib/time/rollup";
import type { ScopeLine } from "@/lib/scope";

import { portfolioRow, type HealthProject } from "./row";
import {
  BLIND_SPOT_CLAUSE,
  NO_FIGURE,
  ON_TRACK_CLAUSE,
  ON_TRACK_ON_MONEY_CLAUSE,
  portfolioReading,
  REASON_CLAUSE,
  UNSTARTED_CLAUSE,
} from "./words";

/**
 * A $10,000 engagement at $100 an hour with nothing configured, so every
 * verdict below is reached at the app's own thresholds.
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

function logged(hours: number): LoggedTotals {
  return {
    entryCount: 1,
    loggedMinutes: hours * 60,
    billableMinutes: hours * 60,
  };
}

function scope(total: number, done: number): ScopeLine[] {
  return Array.from({ length: total }, (_unused, index) => ({
    estimatedMinutes: 600,
    status: index < done ? ("done" as const) : ("pending" as const),
  }));
}

/** The reading a row renders from, assessed the way the page assesses it. */
function reading(
  project: HealthProject,
  totals: LoggedTotals,
  lines: readonly ScopeLine[],
) {
  return portfolioReading(portfolioRow(project, totals, lines));
}

describe("portfolioReading", () => {
  it("leads a flagged row with the worst comparison", () => {
    const read = reading(PROJECT, logged(80), scope(4, 1));

    expect(read.verdict).toBe("Over scope");
    expect(read.reason).toBe(REASON_CLAUSE["burn-far-ahead-of-delivery"]);
  });

  it("leads a watched row with the comparison that flagged it", () => {
    const read = reading(PROJECT, logged(85), scope(4, 3));

    expect(read.verdict).toBe("Worth watching");
    expect(read.reason).toBe(REASON_CLAUSE["contract-nearly-spent"]);
  });

  it("clears a row on both axes when both were read", () => {
    const read = reading(PROJECT, logged(30), scope(4, 1));

    expect(read.verdict).toBe("On track");
    expect(read.reason).toBe(ON_TRACK_CLAUSE);
    expect(read.caveat).toBeNull();
  });

  it("says a row cleared without a delivery axis was cleared on the money", () => {
    const read = reading(PROJECT, logged(30), []);

    expect(read.reason).toBe(ON_TRACK_ON_MONEY_CLAUSE);
    expect(read.caveat).toBe(BLIND_SPOT_CLAUSE["scope-not-estimated"]);
  });

  it("explains an unassessed row with the gap that withheld the verdict", () => {
    const read = reading(
      { ...PROJECT, rateCents: null, clientDefaultRateCents: 0 },
      logged(80),
      scope(4, 1),
    );

    expect(read.verdict).toBe("Not assessed");
    expect(read.reason).toBe(BLIND_SPOT_CLAUSE["burn-not-valued"]);
  });

  it("puts the scope gap under the money gap on an unassessed row", () => {
    const read = reading({ ...PROJECT, contractValueCents: 0 }, logged(10), []);

    expect(read.reason).toBe(BLIND_SPOT_CLAUSE["no-contract-value"]);
    expect(read.caveat).toBe(BLIND_SPOT_CLAUSE["scope-not-estimated"]);
  });

  it("never repeats the reason as the caveat", () => {
    const read = reading({ ...PROJECT, contractValueCents: 0 }, logged(10), []);

    expect(read.caveat).not.toBe(read.reason);
  });

  it("carries a caveat under a flagged verdict that still stands", () => {
    const read = reading(PROJECT, logged(80), [
      { estimatedMinutes: 600, status: "pending" },
      { estimatedMinutes: 0, status: "pending" },
    ]);

    expect(read.verdict).toBe("Over scope");
    expect(read.caveat).toBe(BLIND_SPOT_CLAUSE["scope-partly-estimated"]);
  });

  it("prints the three figures a verdict was reached from", () => {
    const read = reading(PROJECT, logged(80), scope(4, 1));

    expect(read.burned).toBe("$8,000.00");
    expect(read.consumed).toBe("80%");
    expect(read.delivered).toBe("25%");
    expect(read.gap).toBe("55 points");
  });

  it("dashes every figure no rate could produce", () => {
    const read = reading(
      { ...PROJECT, rateCents: null, clientDefaultRateCents: 0 },
      logged(80),
      scope(4, 1),
    );

    expect(read.burned).toBe(NO_FIGURE);
    expect(read.consumed).toBe(NO_FIGURE);
    expect(read.gap).toBe(NO_FIGURE);
  });

  it("still prints the delivered share when the money could not be read", () => {
    const read = reading({ ...PROJECT, contractValueCents: 0 }, logged(10), scope(4, 1));

    expect(read.consumed).toBe(NO_FIGURE);
    expect(read.delivered).toBe("25%");
  });

  it("prints a negative gap on a project ahead of its burn", () => {
    const read = reading(PROJECT, logged(10), scope(4, 2));

    expect(read.verdict).toBe("On track");
    expect(read.gap).toBe("-40 points");
  });

  it("drops the gap once every line of the scope is delivered", () => {
    const read = reading(PROJECT, logged(120), scope(4, 4));

    expect(read.verdict).toBe("Over scope");
    expect(read.gap).toBe(NO_FIGURE);
  });

  it("calls a project nobody has begun not started", () => {
    const read = reading(
      { ...PROJECT, contractValueCents: 0 },
      { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
      [],
    );

    expect(read.verdict).toBe("Not started");
    expect(read.reason).toBe(UNSTARTED_CLAUSE);
    expect(read.caveat).toBeNull();
  });

  it("assesses a project with a price and no hours rather than calling it new", () => {
    const read = reading(
      PROJECT,
      { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
      [],
    );

    expect(read.verdict).toBe("On track");
  });

  it("assesses a project with hours and no price rather than calling it new", () => {
    const read = reading(
      { ...PROJECT, contractValueCents: 0 },
      logged(20),
      [],
    );

    expect(read.verdict).toBe("Not assessed");
  });

  it("assesses a project with a scope list and nothing else", () => {
    const read = reading(
      { ...PROJECT, contractValueCents: 0 },
      { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
      scope(3, 0),
    );

    expect(read.verdict).toBe("Not assessed");
  });

  it("dashes every figure on a project that has not begun", () => {
    const read = reading(
      { ...PROJECT, contractValueCents: 0 },
      { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
      [],
    );

    expect(read.consumed).toBe(NO_FIGURE);
    expect(read.delivered).toBe(NO_FIGURE);
    expect(read.gap).toBe(NO_FIGURE);
  });

  it("never leaves the reason column empty", () => {
    const rows = [
      reading(PROJECT, logged(80), scope(4, 1)),
      reading(PROJECT, logged(30), scope(4, 1)),
      reading(PROJECT, logged(0), []),
      reading({ ...PROJECT, contractValueCents: 0 }, logged(10), []),
      reading(
        { ...PROJECT, contractValueCents: 0 },
        { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
        [],
      ),
    ];

    for (const read of rows) expect(read.reason).not.toBe("");
  });
});
