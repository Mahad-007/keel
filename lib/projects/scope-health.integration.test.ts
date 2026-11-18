import { beforeEach, describe, expect, it } from "vitest";

import { summariseBurn } from "@/lib/burn";
import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  listDeliverables,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import { createProject, getProjectWithClient } from "@/lib/data/projects";
import { createTimeEntry, projectTimeTotals } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { resolveJoinedRate } from "@/lib/rates";

import { assessProjectCreep } from "./creep-readings";
import {
  BLIND_SPOT_SENTENCE,
  hasScopeHealthToShow,
  NOT_ASSESSED_HEADLINE,
  NOT_ASSESSED_LEAD,
  scopeHealthBanner,
  type ScopeHealthBanner,
} from "./scope-health";

/**
 * The banner over rows a database actually holds.
 *
 * `scope-health.test.ts` says what the words are given an assessment.
 * `creep-readings.test.ts` says what the readings are given a burn and a scope
 * list. Neither can say that the sentence a reader ends up looking at is about
 * their project — the burn comes off a rate joined through the client, minutes
 * totalled in SQL and a price on the project, and the delivery comes off a
 * status column on another table.
 *
 * So this is the whole path the project page walks, in one call per test: four
 * modules, two tables and a join, ending in the sentence on screen. The failure
 * it exists to catch is the one that is silent on both sides of it — a verdict
 * that reads correctly and is about the wrong figures.
 */

let db: Database;
/** A client who bills at $200/hr by default, so an hour is a round $200. */
let clientId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient(
    { name: "Harbour Works", defaultRateCents: 20_000 },
    db,
  );
  clientId = client.id;
});

/**
 * The banner as the overview tab assembles one: the burn off the joined rate
 * and the SQL totals, the delivery off the scope list.
 *
 * The same three calls the panel makes, in the same order, so a test that
 * passes here is a statement about the page rather than about a fixture.
 */
async function bannerFor(projectId: string): Promise<ScopeHealthBanner> {
  const [project, totals, lines] = await Promise.all([
    getProjectWithClient(projectId, db),
    projectTimeTotals(projectId, db),
    listDeliverables(projectId, db),
  ]);
  if (project === null) throw new Error("no such project");
  const burn = summariseBurn(
    totals,
    project.contractValueCents,
    resolveJoinedRate(project),
  );

  expect(hasScopeHealthToShow(burn, lines.length)).toBe(true);
  return scopeHealthBanner(assessProjectCreep(burn, lines));
}

describe("the banner over real rows", () => {
  it("explains high burn against low completion", async () => {
    // $10,000 agreed, fifty hours estimated: an implied $200/hr, exactly what
    // the client bills at — so only the delivery can go wrong.
    const project = await createProject(
      { clientId, name: "Portal rebuild", contractValueCents: 1_000_000 },
      db,
    );
    for (const [title, estimatedMinutes] of [
      ["Discovery", 300],
      ["Build", 2_400],
      ["Launch", 300],
    ] as const) {
      await createDeliverable({ projectId: project.id, title, estimatedMinutes }, db);
    }
    // Thirty hours in — $6,000 of the $10,000 — and nothing marked done.
    await createTimeEntry(
      { projectId: project.id, minutes: 1_800, workedOn: "2026-11-02" },
      db,
    );

    const banner = await bannerFor(project.id);

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toContain(
      "60% of the contract has gone on 0% of the estimated work",
    );
    expect(banner.verdict).toContain("60 points ahead of the delivery");
    expect(banner.gaps).toEqual([]);
  });
});
