import { describe, expect, it } from "vitest";

import { DEFAULT_CREEP_THRESHOLDS } from "@/lib/scope-creep";

import type { RiskBand } from "./band";
import type { HealthProject, PortfolioRow } from "./row";
import { countActiveProjects, describePortfolio } from "./words";

/** A row with only the band filled in, which is all the summary reads. */
function row(band: RiskBand): PortfolioRow {
  return {
    project: { id: "prj_1", name: "Site rebuild" } as HealthProject,
    burn: { loggedMinutes: 0 } as PortfolioRow["burn"],
    assessment: {
      health: band === "unassessed" || band === "unstarted" ? null : band,
      reasons: [],
      blindSpots: [],
      consumedShare: null,
      deliveredShare: null,
      gap: null,
      thresholds: DEFAULT_CREEP_THRESHOLDS,
    },
    band,
  };
}

describe("countActiveProjects", () => {
  it("reads one project in the singular", () => {
    expect(countActiveProjects(1)).toBe("1 active project");
  });

  it("reads several in the plural", () => {
    expect(countActiveProjects(11)).toBe("11 active projects");
  });

  it("reads none in the plural", () => {
    expect(countActiveProjects(0)).toBe("0 active projects");
  });
});

describe("describePortfolio", () => {
  it("counts the flagged projects worst first", () => {
    const rows = [
      row("over"),
      row("watch"),
      row("watch"),
      row("healthy"),
      row("healthy"),
    ];

    expect(describePortfolio(rows)).toBe(
      "5 active projects: 1 over scope, 2 worth watching.",
    );
  });

  it("counts the unassessed ones apart from the flagged ones", () => {
    const rows = [row("over"), row("unassessed"), row("healthy")];

    expect(describePortfolio(rows)).toBe(
      "3 active projects: 1 over scope, 1 not assessed.",
    );
  });

  it("says a studio with nothing wrong is all on track", () => {
    expect(describePortfolio([row("healthy"), row("healthy")])).toBe(
      "2 active projects, all on track.",
    );
  });

  it("does not call a studio of unassessed projects on track", () => {
    expect(describePortfolio([row("unassessed")])).toBe(
      "1 active project: 1 not assessed.",
    );
  });

  it("leaves out a band with nothing in it", () => {
    expect(describePortfolio([row("watch")])).toBe(
      "1 active project: 1 worth watching.",
    );
  });

  it("does not count the healthy ones, which are the remainder", () => {
    const rows = [row("over"), ...Array.from({ length: 9 }, () => row("healthy"))];

    expect(describePortfolio(rows)).not.toContain("on track");
  });

  it("counts the projects nobody has begun", () => {
    const rows = [row("healthy"), row("unstarted"), row("unstarted")];

    expect(describePortfolio(rows)).toBe("3 active projects: 2 not started.");
  });

  it("does not call a studio of new projects on track", () => {
    expect(describePortfolio([row("unstarted")])).toBe(
      "1 active project: 1 not started.",
    );
  });

  it("counts the bands in rank order, worst first", () => {
    const rows = [
      row("unstarted"),
      row("healthy"),
      row("unassessed"),
      row("watch"),
      row("over"),
    ];

    expect(describePortfolio(rows)).toBe(
      "5 active projects: 1 over scope, 1 worth watching, 1 not assessed, 1 not started.",
    );
  });

  it("says so when there is no active work at all", () => {
    expect(describePortfolio([])).toBe("No active projects.");
  });
});
