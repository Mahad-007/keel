import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  scopeLinesByProject,
} from "@/lib/data/deliverables";
import { createProject, listProjectsWithClient } from "@/lib/data/projects";
import { createTimeEntry, timeTotalsByProject } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { buildPortfolio } from "./portfolio";
import type { PortfolioRow } from "./row";

/**
 * The portfolio over rows a database actually holds.
 *
 * `portfolio.test.ts` says what the assembly does given three lists.
 * `row.test.ts` says what a verdict is given a project. Neither can say that
 * the row a reader is looking at is about their project: the hours are
 * totalled in SQL and grouped by an id, the scope lines come off another table
 * grouped by the same id, and the rate and the thresholds come through a join
 * with the client.
 *
 * So this is the whole path the page walks, in one call per test — three
 * queries and six modules, ending in the order on screen. The failure it
 * exists to catch is the one that is silent on both sides of it: a ranking
 * that reads correctly and has filed one engagement's hours against another's
 * contract.
 */

let db: Database;
/** A client who bills at $100/hr by default, so an hour is a round $100. */
let clientId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient(
    { name: "Harbour Works", defaultRateCents: 10_000 },
    db,
  );
  clientId = client.id;
});

/** An active engagement at the client's rate, priced as given. */
async function activeProject(
  name: string,
  contractValueCents: number,
): Promise<string> {
  const project = await createProject(
    { clientId, name, status: "active", contractValueCents },
    db,
  );
  return project.id;
}

/** `hours` hours of work on one day, at the project's resolved rate. */
async function logHours(projectId: string, hours: number): Promise<void> {
  await createTimeEntry(
    { projectId, minutes: hours * 60, workedOn: "2026-11-20" },
    db,
  );
}

/** A scope list of `total` ten-hour lines, `done` of them delivered. */
async function agreeScope(
  projectId: string,
  total: number,
  done: number,
): Promise<void> {
  for (let index = 0; index < total; index += 1) {
    await createDeliverable(
      {
        projectId,
        title: `Line ${index + 1}`,
        estimatedMinutes: 600,
        status: index < done ? "done" : "pending",
      },
      db,
    );
  }
}

/**
 * The portfolio as the page assembles one: the active projects joined to their
 * clients, the studio's time totals, the studio's scope lines.
 *
 * The same three reads the page makes, so a test that passes here is a
 * statement about the page rather than about a fixture.
 */
async function portfolio(): Promise<PortfolioRow[]> {
  const [projects, totals, lines] = await Promise.all([
    listProjectsWithClient({ status: "active" }, db),
    timeTotalsByProject(db),
    scopeLinesByProject(db),
  ]);
  return buildPortfolio(projects, totals, lines);
}

describe("the portfolio over stored rows", () => {
  it("values an engagement's hours at its client's default rate", async () => {
    const id = await activeProject("Site rebuild", 1_000_000);
    await logHours(id, 30);
    await agreeScope(id, 4, 1);

    const [row] = await portfolio();

    expect(row.project.id).toBe(id);
    expect(row.burn.rate).toEqual({ cents: 10_000, source: "client" });
    expect(row.burn.burnedCents).toBe(300_000);
    expect(row.assessment.consumedShare).toBeCloseTo(0.3);
  });

  it("reads the delivered share off the scope list's statuses", async () => {
    const id = await activeProject("Site rebuild", 1_000_000);
    await logHours(id, 30);
    await agreeScope(id, 4, 3);

    const [row] = await portfolio();

    expect(row.assessment.deliveredShare).toBeCloseTo(0.75);
  });

  it("files each engagement's hours against its own contract", async () => {
    const leaking = await activeProject("Leaking", 1_000_000);
    const quiet = await activeProject("Quiet", 1_000_000);
    await logHours(leaking, 90);
    await logHours(quiet, 2);
    await agreeScope(leaking, 4, 1);
    await agreeScope(quiet, 4, 1);

    const byId = new Map((await portfolio()).map((row) => [row.project.id, row]));

    expect(byId.get(leaking)?.burn.burnedCents).toBe(900_000);
    expect(byId.get(quiet)?.burn.burnedCents).toBe(20_000);
    expect(byId.get(leaking)?.band).toBe("over");
    expect(byId.get(quiet)?.band).toBe("healthy");
  });

  it("puts the engagement in trouble at the top", async () => {
    const fine = await activeProject("Fine", 1_000_000);
    const leaking = await activeProject("Leaking", 1_000_000);
    await logHours(fine, 20);
    await logHours(leaking, 90);
    await agreeScope(fine, 4, 2);
    await agreeScope(leaking, 4, 1);

    expect((await portfolio()).map((row) => row.project.name)).toEqual([
      "Leaking",
      "Fine",
    ]);
  });

  it("leaves out the engagements that are not active", async () => {
    const active = await activeProject("Running", 1_000_000);
    await createProject(
      { clientId, name: "Idea", contractValueCents: 500_000 },
      db,
    );

    expect((await portfolio()).map((row) => row.project.id)).toEqual([active]);
  });

  it("ranks a project with no scope and no hours rather than dropping it", async () => {
    const bare = await activeProject("Just agreed", 500_000);

    const [row] = await portfolio();

    expect(row.project.id).toBe(bare);
    expect(row.burn.loggedMinutes).toBe(0);
    expect(row.band).toBe("healthy");
  });

  it("withholds a verdict on hours no rate values", async () => {
    const unrated = await createClient({ name: "No Rate Co" }, db);
    const project = await createProject(
      {
        clientId: unrated.id,
        name: "Unpriced hours",
        status: "active",
        contractValueCents: 1_000_000,
      },
      db,
    );
    await logHours(project.id, 80);

    const [row] = await portfolio();

    expect(row.band).toBe("unassessed");
    expect(row.assessment.blindSpots).toContain("burn-not-valued");
  });

  it("judges a project by the threshold set on its client", async () => {
    const strict = await createClient(
      { name: "Strict Co", defaultRateCents: 10_000, nearlySpentPercent: 50 },
      db,
    );
    const project = await createProject(
      {
        clientId: strict.id,
        name: "Watched early",
        status: "active",
        contractValueCents: 1_000_000,
      },
      db,
    );
    await logHours(project.id, 60);
    await agreeScope(project.id, 4, 3);

    const [row] = await portfolio();

    expect(row.band).toBe("watch");
    expect(row.assessment.thresholds.nearlySpentShare).toBeCloseTo(0.5);
  });

  it("carries the client's name and whether they are off the books", async () => {
    const id = await activeProject("Site rebuild", 1_000_000);

    const [row] = await portfolio();

    expect(row.project.id).toBe(id);
    expect(row.project.clientName).toBe("Harbour Works");
    expect(row.project.clientArchivedAt).toBeNull();
  });

  it("holds nothing for a studio with no active engagements", async () => {
    await createProject({ clientId, name: "Idea" }, db);

    expect(await portfolio()).toEqual([]);
  });
});
