import { describe, expect, it } from "vitest";

import type { ProjectScopeLine } from "@/lib/scope";
import { NO_THRESHOLD_OVERRIDES } from "@/lib/thresholds/resolve";
import type { ProjectLoggedTotals } from "@/lib/time/rollup";

import {
  buildPortfolio,
  countByBand,
  flaggedCount,
  groupByProject,
} from "./portfolio";
import type { HealthProject } from "./row";

describe("groupByProject", () => {
  it("files each row under the project it names", () => {
    const grouped = groupByProject([
      { projectId: "prj_a", value: 1 },
      { projectId: "prj_b", value: 2 },
    ]);

    expect(grouped.get("prj_a")).toEqual([{ projectId: "prj_a", value: 1 }]);
    expect(grouped.get("prj_b")).toEqual([{ projectId: "prj_b", value: 2 }]);
  });

  it("keeps several rows for one project in the order they arrived", () => {
    const grouped = groupByProject([
      { projectId: "prj_a", value: 1 },
      { projectId: "prj_b", value: 9 },
      { projectId: "prj_a", value: 2 },
      { projectId: "prj_a", value: 3 },
    ]);

    expect(grouped.get("prj_a")?.map((row) => row.value)).toEqual([1, 2, 3]);
  });

  it("has no group for a project no row mentions", () => {
    const grouped = groupByProject([{ projectId: "prj_a", value: 1 }]);

    expect(grouped.get("prj_b")).toBeUndefined();
  });

  it("groups nothing out of an empty list", () => {
    expect(groupByProject([]).size).toBe(0);
  });
});

/**
 * A $10,000 engagement billing at $100 an hour, with nothing configured — so
 * every verdict below is reached at the app's own thresholds.
 */
function project(
  id: string,
  fields: Partial<HealthProject> = {},
): HealthProject {
  return {
    id,
    name: `Project ${id}`,
    clientId: "cli_1",
    clientName: "Harbour Co",
    clientArchivedAt: null,
    contractValueCents: 1_000_000,
    rateCents: 10_000,
    clientDefaultRateCents: 0,
    ...NO_THRESHOLD_OVERRIDES,
    clientThresholds: NO_THRESHOLD_OVERRIDES,
    ...fields,
  };
}

/** `hours` hours logged against one project, every minute chargeable. */
function totals(projectId: string, hours: number): ProjectLoggedTotals {
  return {
    projectId,
    entryCount: 1,
    loggedMinutes: hours * 60,
    billableMinutes: hours * 60,
  };
}

/** A scope list of `total` equal lines for one project, `done` delivered. */
function scope(
  projectId: string,
  total: number,
  done: number,
): ProjectScopeLine[] {
  return Array.from({ length: total }, (_unused, index) => ({
    projectId,
    estimatedMinutes: 600,
    status: index < done ? ("done" as const) : ("pending" as const),
  }));
}

describe("buildPortfolio", () => {
  it("assesses one project from its own totals and its own lines", () => {
    const rows = buildPortfolio(
      [project("prj_a")],
      [totals("prj_a", 30)],
      scope("prj_a", 4, 1),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].burn.loggedMinutes).toBe(1_800);
    expect(rows[0].assessment.deliveredShare).toBeCloseTo(0.25);
  });

  it("keeps one project's hours off another's row", () => {
    const rows = buildPortfolio(
      [project("prj_a"), project("prj_b")],
      [totals("prj_a", 80), totals("prj_b", 2)],
      [...scope("prj_a", 4, 1), ...scope("prj_b", 4, 3)],
    );

    const byId = new Map(rows.map((row) => [row.project.id, row]));
    expect(byId.get("prj_a")?.burn.loggedMinutes).toBe(4_800);
    expect(byId.get("prj_b")?.burn.loggedMinutes).toBe(120);
  });

  it("keeps one project's scope lines off another's row", () => {
    const rows = buildPortfolio(
      [project("prj_a"), project("prj_b")],
      [],
      scope("prj_a", 4, 2),
    );

    const byId = new Map(rows.map((row) => [row.project.id, row]));
    expect(byId.get("prj_a")?.assessment.deliveredShare).toBeCloseTo(0.5);
    expect(byId.get("prj_b")?.assessment.deliveredShare).toBeNull();
  });

  it("ranks a project nobody has logged against as nothing burned", () => {
    const rows = buildPortfolio([project("prj_a")], [], []);

    expect(rows).toHaveLength(1);
    expect(rows[0].burn.loggedMinutes).toBe(0);
    expect(rows[0].burn.burnedCents).toBe(0);
  });

  it("ignores totals for a project that is not on the list", () => {
    const rows = buildPortfolio(
      [project("prj_a")],
      [totals("prj_a", 10), totals("prj_closed", 400)],
      [],
    );

    expect(rows.map((row) => row.project.id)).toEqual(["prj_a"]);
    expect(rows[0].burn.loggedMinutes).toBe(600);
  });

  it("ignores scope lines for a project that is not on the list", () => {
    const rows = buildPortfolio(
      [project("prj_a")],
      [],
      scope("prj_closed", 4, 4),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].assessment.deliveredShare).toBeNull();
  });

  it("ranks the worst project first", () => {
    const rows = buildPortfolio(
      [project("prj_fine"), project("prj_over"), project("prj_watch")],
      [
        totals("prj_fine", 20),
        totals("prj_over", 120),
        totals("prj_watch", 85),
      ],
      [
        ...scope("prj_fine", 4, 2),
        ...scope("prj_over", 4, 1),
        ...scope("prj_watch", 4, 3),
      ],
    );

    expect(rows.map((row) => row.project.id)).toEqual([
      "prj_over",
      "prj_watch",
      "prj_fine",
    ]);
  });

  it("ranks an unassessed project above a healthy one", () => {
    const rows = buildPortfolio(
      [
        project("prj_fine"),
        project("prj_unpriced", { contractValueCents: 0 }),
      ],
      [totals("prj_fine", 20), totals("prj_unpriced", 90)],
      [...scope("prj_fine", 4, 2), ...scope("prj_unpriced", 4, 1)],
    );

    expect(rows.map((row) => row.project.id)).toEqual([
      "prj_unpriced",
      "prj_fine",
    ]);
  });

  it("holds no rows for a studio with no active projects", () => {
    expect(buildPortfolio([], [totals("prj_a", 10)], scope("prj_a", 2, 1))).toEqual(
      [],
    );
  });
});

describe("countByBand", () => {
  it("counts every band, including the ones with nothing in them", () => {
    const rows = buildPortfolio(
      [project("prj_fine"), project("prj_over")],
      [totals("prj_fine", 20), totals("prj_over", 120)],
      [...scope("prj_fine", 4, 2), ...scope("prj_over", 4, 1)],
    );

    expect(countByBand(rows)).toEqual({
      over: 1,
      watch: 0,
      unassessed: 0,
      healthy: 1,
    });
  });

  it("counts nothing at all for an empty portfolio", () => {
    expect(countByBand([])).toEqual({
      over: 0,
      watch: 0,
      unassessed: 0,
      healthy: 0,
    });
  });

  it("adds up to the number of rows", () => {
    const rows = buildPortfolio(
      [
        project("prj_fine"),
        project("prj_over"),
        project("prj_unpriced", { contractValueCents: 0 }),
      ],
      [
        totals("prj_fine", 20),
        totals("prj_over", 120),
        totals("prj_unpriced", 5),
      ],
      scope("prj_fine", 4, 2),
    );

    const counted = Object.values(countByBand(rows)).reduce((a, b) => a + b, 0);
    expect(counted).toBe(rows.length);
  });
});

describe("flaggedCount", () => {
  it("counts the projects a comparison came out badly for", () => {
    const rows = buildPortfolio(
      [project("prj_over"), project("prj_watch"), project("prj_fine")],
      [
        totals("prj_over", 120),
        totals("prj_watch", 85),
        totals("prj_fine", 20),
      ],
      [
        ...scope("prj_over", 4, 1),
        ...scope("prj_watch", 4, 3),
        ...scope("prj_fine", 4, 2),
      ],
    );

    expect(flaggedCount(rows)).toBe(2);
  });

  it("does not count an unassessed project as flagged", () => {
    const rows = buildPortfolio(
      [project("prj_unpriced", { contractValueCents: 0 })],
      [totals("prj_unpriced", 90)],
      scope("prj_unpriced", 4, 1),
    );

    expect(rows[0].band).toBe("unassessed");
    expect(flaggedCount(rows)).toBe(0);
  });

  it("counts nothing in an empty portfolio", () => {
    expect(flaggedCount([])).toBe(0);
  });
});
