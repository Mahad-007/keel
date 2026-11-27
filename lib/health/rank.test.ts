import { describe, expect, it } from "vitest";

import { DEFAULT_CREEP_THRESHOLDS } from "@/lib/scope-creep";

import type { RiskBand } from "./band";
import { compareRisk, compareWorseFirst, rankedPortfolio } from "./rank";
import type { HealthProject, PortfolioRow } from "./row";

describe("compareWorseFirst", () => {
  it("puts the larger figure first", () => {
    expect(compareWorseFirst(0.9, 0.4)).toBeLessThan(0);
    expect(compareWorseFirst(0.4, 0.9)).toBeGreaterThan(0);
  });

  it("calls two equal figures a tie", () => {
    expect(compareWorseFirst(0.5, 0.5)).toBe(0);
  });

  it("puts a missing figure last", () => {
    expect(compareWorseFirst(null, 0.1)).toBeGreaterThan(0);
    expect(compareWorseFirst(0.1, null)).toBeLessThan(0);
  });

  it("does not read a missing figure as nought", () => {
    expect(compareWorseFirst(null, 0)).toBeGreaterThan(0);
  });

  it("calls two missing figures a tie", () => {
    expect(compareWorseFirst(null, null)).toBe(0);
  });
});

/**
 * A row with only the fields the order reads filled in. Built by hand rather
 * than through `portfolioRow`, because a comparison is worth testing at
 * readings the classifier would never pair — two projects that differ in one
 * figure and nothing else.
 */
function row(
  fields: {
    id?: string;
    name?: string;
    clientName?: string;
    band?: RiskBand;
    consumedShare?: number | null;
    gap?: number | null;
    loggedMinutes?: number;
  } = {},
): PortfolioRow {
  const project = {
    id: fields.id ?? "prj_1",
    name: fields.name ?? "Site rebuild",
    clientName: fields.clientName ?? "Harbour Co",
  } as HealthProject;

  return {
    project,
    burn: { loggedMinutes: fields.loggedMinutes ?? 0 } as PortfolioRow["burn"],
    assessment: {
      health: null,
      reasons: [],
      blindSpots: [],
      consumedShare: fields.consumedShare ?? null,
      deliveredShare: null,
      gap: fields.gap ?? null,
      thresholds: DEFAULT_CREEP_THRESHOLDS,
    },
    band: fields.band ?? "healthy",
  };
}

describe("compareRisk", () => {
  it("puts an overspent project above one worth watching", () => {
    expect(
      compareRisk(row({ band: "over" }), row({ band: "watch" })),
    ).toBeLessThan(0);
  });

  it("puts an unassessed project above a healthy one", () => {
    expect(
      compareRisk(row({ band: "unassessed" }), row({ band: "healthy" })),
    ).toBeLessThan(0);
  });

  it("puts a flagged project above an unassessed one", () => {
    expect(
      compareRisk(row({ band: "watch" }), row({ band: "unassessed" })),
    ).toBeLessThan(0);
  });

  it("ignores every other figure when the bands differ", () => {
    const worse = row({ band: "watch", consumedShare: 0.81, loggedMinutes: 10 });
    const over = row({ band: "over", consumedShare: 0.1, loggedMinutes: 0 });

    expect(compareRisk(over, worse)).toBeLessThan(0);
  });

  it("puts the bigger share of the contract first inside a band", () => {
    const deep = row({ band: "over", consumedShare: 1.6 });
    const shallow = row({ band: "over", consumedShare: 1.05 });

    expect(compareRisk(deep, shallow)).toBeLessThan(0);
  });

  it("breaks a tied share on the wider gap", () => {
    const wide = row({ band: "watch", consumedShare: 0.85, gap: 0.5 });
    const narrow = row({ band: "watch", consumedShare: 0.85, gap: 0.1 });

    expect(compareRisk(wide, narrow)).toBeLessThan(0);
  });

  it("puts a project with no readable gap below one that has it", () => {
    const measured = row({ band: "over", consumedShare: 1.2, gap: 0.05 });
    const unmeasured = row({ band: "over", consumedShare: 1.2, gap: null });

    expect(compareRisk(measured, unmeasured)).toBeLessThan(0);
  });

  it("puts a healthy project above one that has not begun", () => {
    expect(
      compareRisk(row({ band: "healthy" }), row({ band: "unstarted" })),
    ).toBeLessThan(0);
  });

  it("puts an unassessed project above one that has not begun", () => {
    expect(
      compareRisk(row({ band: "unassessed" }), row({ band: "unstarted" })),
    ).toBeLessThan(0);
  });

  it("ranks unassessed projects by the hours nobody could value", () => {
    const many = row({ band: "unassessed", loggedMinutes: 4_800 });
    const few = row({ band: "unassessed", loggedMinutes: 20 });

    expect(compareRisk(many, few)).toBeLessThan(0);
  });

  it("falls back to the client name when every figure ties", () => {
    const anvil = row({ clientName: "Anvil Co" });
    const harbour = row({ clientName: "Harbour Co" });

    expect(compareRisk(anvil, harbour)).toBeLessThan(0);
  });

  it("falls back to the project name within one client", () => {
    const first = row({ name: "Audit" });
    const second = row({ name: "Rebuild" });

    expect(compareRisk(first, second)).toBeLessThan(0);
  });

  it("breaks the last tie on the id so two rows cannot swap", () => {
    const left = row({ id: "prj_a" });
    const right = row({ id: "prj_b" });

    expect(compareRisk(left, right)).toBeLessThan(0);
    expect(compareRisk(right, left)).toBeGreaterThan(0);
  });

  it("calls a row equal to itself", () => {
    const only = row({ band: "over", consumedShare: 1.2, gap: 0.3 });

    expect(compareRisk(only, only)).toBe(0);
  });
});

describe("rankedPortfolio", () => {
  it("puts the five bands in order", () => {
    const rows = [
      row({ id: "prj_h", band: "healthy" }),
      row({ id: "prj_n", band: "unstarted" }),
      row({ id: "prj_u", band: "unassessed" }),
      row({ id: "prj_o", band: "over" }),
      row({ id: "prj_w", band: "watch" }),
    ];

    expect(rankedPortfolio(rows).map((each) => each.project.id)).toEqual([
      "prj_o",
      "prj_w",
      "prj_u",
      "prj_h",
      "prj_n",
    ]);
  });

  it("leaves the list it was given alone", () => {
    const rows = [
      row({ id: "prj_h", band: "healthy" }),
      row({ id: "prj_o", band: "over" }),
    ];

    rankedPortfolio(rows);

    expect(rows.map((each) => each.project.id)).toEqual(["prj_h", "prj_o"]);
  });

  it("ranks the same list the same way twice", () => {
    const rows = [
      row({ id: "prj_a", band: "watch", consumedShare: 0.8 }),
      row({ id: "prj_b", band: "watch", consumedShare: 0.8 }),
      row({ id: "prj_c", band: "watch", consumedShare: 0.9 }),
    ];

    const first = rankedPortfolio(rows).map((each) => each.project.id);
    const second = rankedPortfolio([...rows].reverse()).map(
      (each) => each.project.id,
    );

    expect(first).toEqual(second);
  });

  it("hands back an empty list for no projects", () => {
    expect(rankedPortfolio([])).toEqual([]);
  });
});
