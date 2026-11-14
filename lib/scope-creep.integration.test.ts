import { beforeEach, describe, expect, it } from "vitest";

import { summariseBurn } from "@/lib/burn";
import { createClient } from "@/lib/data/clients";
import { createDeliverable, listDeliverables } from "@/lib/data/deliverables";
import { createProject, getProjectWithClient } from "@/lib/data/projects";
import { createTimeEntry, projectTimeTotals } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { hasValuedBurn } from "@/lib/projects/burn-summary";
import { resolveJoinedRate } from "@/lib/rates";
import { allDelivered, deliveredShare } from "@/lib/scope";

import { assessScopeCreep, type CreepReadings } from "./scope-creep";

/**
 * The classifier over rows a database actually holds.
 *
 * `scope-creep.test.ts` says what the verdict is given two shares. What it
 * cannot say is that those two shares are the ones a real project produces:
 * the consumed share comes off a rate joined through the client, minutes
 * totalled in SQL and a contract value on the project, and the delivered share
 * comes off a status column on a different table entirely.
 *
 * Four modules meet in `CreepReadings`, and nothing but this test checks that
 * the figures arrive in the arguments they belong in. The expensive version of
 * getting it wrong is silent in every unit test on either side: swap the two
 * shares and a project that has delivered everything for a tenth of its budget
 * is classified `over`, while the one burning its contract on nothing reads
 * `healthy`.
 */

let db: Database;
/** A client who bills at $200/hr by default, so an hour is a round $200. */
let clientId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient(
    { name: "Lantern Group", defaultRateCents: 20_000 },
    db,
  );
  clientId = client.id;
});

/**
 * The readings as a project page would assemble them: a burn off the joined
 * rate and the SQL totals, a delivered share off the scope list, and the two
 * facts that say whether either can be trusted.
 */
async function readingsFor(projectId: string): Promise<CreepReadings> {
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
  return {
    consumedShare: burn.consumedShare,
    deliveredShare: deliveredShare(lines),
    burnValued: hasValuedBurn(burn),
    scopeDelivered: allDelivered(lines),
  };
}

describe("the classifier over real rows", () => {
  it("calls out high burn against low completion", async () => {
    // $10,000 agreed, estimated at fifty hours: an implied $200/hr, which is
    // exactly what the client bills at — so the money and the hours track
    // each other and the only thing that can go wrong is the delivery.
    const project = await createProject(
      { clientId, name: "Portal rebuild", contractValueCents: 1_000_000 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Discovery", estimatedMinutes: 300 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Build", estimatedMinutes: 2_400 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Launch", estimatedMinutes: 300 },
      db,
    );
    // Thirty hours in — $6,000 of the $10,000 — and nothing marked done.
    await createTimeEntry(
      { projectId: project.id, minutes: 1_800, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBe("over");
    expect(assessment.reasons).toEqual(["burn-far-ahead-of-delivery"]);
    expect(assessment.consumedShare).toBeCloseTo(0.6);
    expect(assessment.deliveredShare).toBe(0);
    expect(assessment.blindSpots).toEqual([]);
  });
});
