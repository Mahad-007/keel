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
  AHEAD_CLOSING,
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

  it("values the hours at the client's default rate when the project has none", async () => {
    // No override on the project, so the $200/hr comes through the join. Get
    // that wrong and the burn is nought and the project reads unassessable.
    const project = await createProject(
      { clientId, name: "Retainer work", contractValueCents: 400_000 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Audit", estimatedMinutes: 600 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Fixes", estimatedMinutes: 600 },
      db,
    );
    // Ten hours, $2,000 of $4,000, and the first of two lines handed over.
    await createTimeEntry(
      { projectId: project.id, minutes: 600, workedOn: "2026-11-03" },
      db,
    );
    const [audit] = await listDeliverables(project.id, db);
    await setDeliverableStatus(audit.id, audit.status, "done", db);

    const banner = await bannerFor(project.id);

    expect(banner.headline).toBe("On track");
    expect(banner.verdict).toContain(
      "50% of the contract has gone on 50% of the estimated work",
    );
    expect(banner.gaps).toEqual([]);
  });

  it("withholds a verdict from hours no rate can value", async () => {
    const bare = await createClient({ name: "No default rate" }, db);
    const project = await createProject(
      { clientId: bare.id, name: "Unpriced hours", contractValueCents: 500_000 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Phase one", estimatedMinutes: 1_200 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Phase two", estimatedMinutes: 1_200 },
      db,
    );
    // Eighty hours in, and nothing anywhere says what an hour is worth.
    await createTimeEntry(
      { projectId: project.id, minutes: 4_800, workedOn: "2026-11-04" },
      db,
    );

    const banner = await bannerFor(project.id);

    // The arithmetic says nought burned, which would read as an engagement
    // that has barely started. The banner says nobody can tell.
    expect(banner.headline).toBe(NOT_ASSESSED_HEADLINE);
    expect(banner.verdict).toBe(NOT_ASSESSED_LEAD);
    expect(banner.gaps).toEqual([BLIND_SPOT_SENTENCE["burn-not-valued"]]);
  });

  it("withholds a verdict from a scope list nobody put a price on", async () => {
    // Deliverables agreed, estimated, half delivered, and no contract value.
    // There is plenty to read and nothing to measure it against.
    const project = await createProject(
      { clientId, name: "Unpriced scope" },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Wireframes", estimatedMinutes: 600 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Build", estimatedMinutes: 600 },
      db,
    );
    const [wireframes] = await listDeliverables(project.id, db);
    await setDeliverableStatus(wireframes.id, wireframes.status, "done", db);

    const banner = await bannerFor(project.id);

    expect(banner.headline).toBe(NOT_ASSESSED_HEADLINE);
    expect(banner.gaps).toEqual([BLIND_SPOT_SENTENCE["no-contract-value"]]);
  });

  it("calls out a contract spent in full on an unfinished list", async () => {
    const project = await createProject(
      { clientId, name: "Overrun", contractValueCents: 200_000 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Spec", estimatedMinutes: 300 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Delivery", estimatedMinutes: 300 },
      db,
    );
    const [spec] = await listDeliverables(project.id, db);
    await setDeliverableStatus(spec.id, spec.status, "done", db);
    // Twelve hours at $200 is $2,400 against a $2,000 contract.
    await createTimeEntry(
      { projectId: project.id, minutes: 720, workedOn: "2026-11-05" },
      db,
    );

    const banner = await bannerFor(project.id);

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toContain("120% of the contract value");
    expect(banner.verdict).toContain("the agreement does not pay for");
    expect(banner.gaps).toEqual([]);
  });

  it("keeps the bullet under an overspent lead from excusing it", async () => {
    // The pair that stacks worst. The money is over and the gap has only
    // reached a quarter, so the lead is the overspend and the bullet under it
    // is a watch — and a watch sentence written for a project with budget left
    // would be offering a conversation about money that has gone.
    const project = await createProject(
      { clientId, name: "Late overrun", contractValueCents: 1_000_000 },
      db,
    );
    for (const [title, estimatedMinutes] of [
      ["Discovery", 600],
      ["Build", 1_800],
      ["Launch", 600],
    ] as const) {
      await createDeliverable({ projectId: project.id, title, estimatedMinutes }, db);
    }
    for (const line of (await listDeliverables(project.id, db)).slice(0, 2)) {
      await setDeliverableStatus(line.id, line.status, "done", db);
    }
    // Fifty-five hours at $200 is $11,000 against the $10,000 agreed, and
    // 2,400 of the 3,000 estimated minutes are signed off: 110% against 80%.
    await createTimeEntry(
      { projectId: project.id, minutes: 3_300, workedOn: "2026-11-07" },
      db,
    );

    const banner = await bannerFor(project.id);

    expect(banner.headline).toBe("Over scope");
    expect(banner.verdict).toContain("110% of the contract value");
    expect(banner.reasons).toEqual([
      `110% of the contract has gone on 80% of the estimated work — the burn is running 30 points ahead of the delivery. ${AHEAD_CLOSING.over}`,
    ]);
    expect(banner.reasons[0]).not.toContain("conversation");
    expect(banner.gaps).toEqual([]);
  });

  it("clears a project that delivered its whole list inside its price", async () => {
    const project = await createProject(
      { clientId, name: "Landed well", contractValueCents: 400_000 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Phase one", estimatedMinutes: 480 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Phase two", estimatedMinutes: 480 },
      db,
    );
    for (const line of await listDeliverables(project.id, db)) {
      await setDeliverableStatus(line.id, line.status, "done", db);
    }
    // Sixteen hours at $200 is $3,200 of the $4,000 agreed: 80% spent, and
    // every line handed over. Four fifths of a price for all of the work is a
    // job well done, not a project to flag.
    await createTimeEntry(
      { projectId: project.id, minutes: 960, workedOn: "2026-11-06" },
      db,
    );

    const banner = await bannerFor(project.id);

    expect(banner.headline).toBe("On track");
    expect(banner.verdict).toContain(
      "80% of the contract has gone on 100% of the estimated work",
    );
    expect(banner.reasons).toEqual([]);
    expect(banner.gaps).toEqual([]);
  });
});
