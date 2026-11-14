import { eq } from "drizzle-orm";
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
import { deliverables } from "@/lib/db/schema";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { hasValuedBurn } from "@/lib/projects/burn-summary";
import { resolveJoinedRate } from "@/lib/rates";
import {
  allDelivered,
  deliveredShare,
  negativeEstimateCount,
  unestimatedCount,
  unestimatedDeliveredCount,
} from "@/lib/scope";

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
    lineCount: lines.length,
    unestimatedCount: unestimatedCount(lines),
    unestimatedDeliveredCount: unestimatedDeliveredCount(lines),
    negativeEstimateCount: negativeEstimateCount(lines),
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

  it("calls a project delivering in step with its burn healthy", async () => {
    const project = await createProject(
      { clientId, name: "Steady build", contractValueCents: 1_000_000 },
      db,
    );
    const first = await createDeliverable(
      { projectId: project.id, title: "Phase one", estimatedMinutes: 1_500 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Phase two", estimatedMinutes: 1_500 },
      db,
    );
    await setDeliverableStatus(first.id, first.status, "done", db);
    // Twenty-five hours — $5,000 of $10,000 — for half the estimated work.
    await createTimeEntry(
      { projectId: project.id, minutes: 1_500, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBe("healthy");
    expect(assessment.reasons).toEqual([]);
    expect(assessment.consumedShare).toBeCloseTo(0.5);
    expect(assessment.deliveredShare).toBeCloseTo(0.5);
    expect(assessment.gap).toBeCloseTo(0);
  });

  it("calls a project past its contract over, however much is delivered", async () => {
    const project = await createProject(
      { clientId, name: "Overrun", contractValueCents: 400_000 },
      db,
    );
    const only = await createDeliverable(
      {
        projectId: project.id,
        title: "The whole job",
        estimatedMinutes: 1_200,
      },
      db,
    );
    await setDeliverableStatus(only.id, only.status, "done", db);
    // Thirty hours at $200 — $6,000 against a $4,000 contract.
    await createTimeEntry(
      { projectId: project.id, minutes: 1_800, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBe("over");
    expect(assessment.reasons).toContain("contract-overspent");
    expect(assessment.consumedShare).toBeCloseTo(1.5);
    expect(assessment.deliveredShare).toBe(1);
  });

  it("leaves a project finished inside its budget unflagged", async () => {
    const project = await createProject(
      { clientId, name: "Came in under", contractValueCents: 1_000_000 },
      db,
    );
    const only = await createDeliverable(
      {
        projectId: project.id,
        title: "The whole job",
        estimatedMinutes: 3_000,
      },
      db,
    );
    await setDeliverableStatus(only.id, only.status, "done", db);
    // Forty-five hours — $9,000 of the $10,000 — and every line done.
    await createTimeEntry(
      { projectId: project.id, minutes: 2_700, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.consumedShare).toBeCloseTo(0.9);
    expect(assessment.health).toBe("healthy");
    expect(assessment.reasons).toEqual([]);
  });
});

describe("the classifier over rows with a field unfilled", () => {
  it("withholds a verdict on hours nobody can price", async () => {
    const bare = await createClient({ name: "No default rate" }, db);
    const project = await createProject(
      {
        clientId: bare.id,
        name: "Unpriced hours",
        contractValueCents: 1_000_000,
      },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Build", estimatedMinutes: 1_500 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Launch", estimatedMinutes: 1_500 },
      db,
    );
    // Eighty hours logged, and nothing anywhere says what an hour is worth.
    await createTimeEntry(
      { projectId: project.id, minutes: 4_800, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBeNull();
    expect(assessment.blindSpots).toEqual(["burn-not-valued"]);
    expect(assessment.consumedShare).toBeNull();
  });

  it("withholds a verdict with no contract value to measure against", async () => {
    const project = await createProject(
      { clientId, name: "No price agreed" },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Build", estimatedMinutes: 1_500 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Launch", estimatedMinutes: 1_500 },
      db,
    );
    await createTimeEntry(
      { projectId: project.id, minutes: 1_800, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBeNull();
    expect(assessment.blindSpots).toEqual(["no-contract-value"]);
  });

  it("still judges the money on a project nobody has estimated", async () => {
    const project = await createProject(
      { clientId, name: "Unestimated", contractValueCents: 400_000 },
      db,
    );
    // Twenty-five hours at $200 — $5,000 against a $4,000 contract — with no
    // deliverables at all, so there is nothing to compare the delivery against.
    await createTimeEntry(
      { projectId: project.id, minutes: 1_500, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBe("over");
    expect(assessment.reasons).toEqual(["contract-overspent"]);
    expect(assessment.blindSpots).toEqual(["scope-not-estimated"]);
    expect(assessment.gap).toBeNull();
  });

  it("is healthy on a project with a price and nothing logged", async () => {
    const project = await createProject(
      { clientId, name: "Not started", contractValueCents: 1_000_000 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Build", estimatedMinutes: 1_500 },
      db,
    );
    await createDeliverable(
      { projectId: project.id, title: "Launch", estimatedMinutes: 1_500 },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.health).toBe("healthy");
    expect(assessment.consumedShare).toBe(0);
    expect(assessment.deliveredShare).toBe(0);
  });
});

describe("the classifier over a scope list edited straight in the database", () => {
  it("reads the delivery axis off nothing when an estimate is negative", async () => {
    const project = await createProject(
      { clientId, name: "Hand-edited", contractValueCents: 1_000_000 },
      db,
    );
    const done = await createDeliverable(
      { projectId: project.id, title: "Shipped", estimatedMinutes: 2_100 },
      db,
    );
    const open = await createDeliverable(
      { projectId: project.id, title: "Still open", estimatedMinutes: 600 },
      db,
    );
    await setDeliverableStatus(done.id, done.status, "done", db);
    // No form in the app accepts this; the column does.
    await db
      .update(deliverables)
      .set({ estimatedMinutes: -600 })
      .where(eq(deliverables.id, open.id));
    // Forty-five hours at $200 — $9,000 of the $10,000 agreed.
    await createTimeEntry(
      { projectId: project.id, minutes: 2_700, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.deliveredShare).toBeNull();
    expect(assessment.blindSpots).toEqual(["scope-estimates-invalid"]);
    expect(assessment.health).toBe("watch");
    expect(assessment.reasons).toEqual(["contract-nearly-spent"]);
  });
});

describe("the classifier over a scope list only half sized", () => {
  it("reads a sized line done as the best the completion can be", async () => {
    const project = await createProject(
      { clientId, name: "Half sized", contractValueCents: 1_000_000 },
      db,
    );
    const sized = await createDeliverable(
      { projectId: project.id, title: "Discovery", estimatedMinutes: 600 },
      db,
    );
    await createDeliverable({ projectId: project.id, title: "Build" }, db);
    await createDeliverable({ projectId: project.id, title: "Launch" }, db);
    await setDeliverableStatus(sized.id, sized.status, "done", db);
    // Forty-five hours at $200 — $9,000 of the $10,000 agreed — with two
    // thirds of the list unsized and untouched.
    await createTimeEntry(
      { projectId: project.id, minutes: 2_700, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.deliveredShare).toBe(1);
    expect(assessment.blindSpots).toEqual(["scope-partly-estimated"]);
    expect(assessment.health).toBe("watch");
    expect(assessment.reasons).toEqual(["contract-nearly-spent"]);
  });

  it("judges a single-deliverable project on its money alone", async () => {
    const project = await createProject(
      { clientId, name: "One line", contractValueCents: 1_000_000 },
      db,
    );
    await createDeliverable(
      {
        projectId: project.id,
        title: "The whole job",
        estimatedMinutes: 3_000,
      },
      db,
    );
    // Thirty hours at $200 — $6,000 of the $10,000 — and nothing signed off,
    // which is the only reading a one-line list can give before the end.
    await createTimeEntry(
      { projectId: project.id, minutes: 1_800, workedOn: "2026-11-02" },
      db,
    );

    const assessment = assessScopeCreep(await readingsFor(project.id));

    expect(assessment.blindSpots).toEqual(["scope-too-coarse"]);
    expect(assessment.gap).toBeNull();
    expect(assessment.health).toBe("healthy");
  });
});
