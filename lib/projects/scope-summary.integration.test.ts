import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  listDeliverables,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import { createProject, getProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { summariseScope } from "@/lib/scope";

import { scopeSummaryFigures, type ScopeFigure } from "./scope-summary";

/**
 * The sentences, over rows a database actually holds.
 *
 * `scope-summary.test.ts` says what each figure reads like given a summary,
 * and `scope.integration.test.ts` says the summary can be taken over real
 * deliverable rows. What neither covers is the join the panel makes: a list
 * read through the data layer and a contract value read off the project,
 * turned into the four lines a reader sees. That is the thing a renamed column
 * or a changed default breaks silently, because every unit test on either side
 * of it still passes.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    {
      clientId: client.id,
      name: "Engine rewrite",
      // $4,000 for the engagement.
      contractValueCents: 400_000,
    },
    db,
  );
  projectId = project.id;
});

/** The figures as the panel would receive them, from two reads. */
async function figures(): Promise<ScopeFigure[]> {
  const [lines, project] = await Promise.all([
    listDeliverables(projectId, db),
    getProject(projectId, db),
  ]);
  return scopeSummaryFigures(
    summariseScope(lines, project?.contractValueCents ?? 0),
  );
}

/** One figure by the label a reader would look for it under. */
function figure(all: readonly ScopeFigure[], label: string): ScopeFigure {
  const found = all.find((one) => one.label === label);
  if (found === undefined) throw new Error(`no figure labelled ${label}`);
  return found;
}

describe("the panel over a scope list just written", () => {
  beforeEach(async () => {
    for (const [title, estimatedMinutes] of [
      ["Discovery", 480],
      ["Build", 1_440],
      ["Handover", 480],
    ] as const) {
      await createDeliverable({ projectId, title, estimatedMinutes }, db);
    }
  });

  it("totals the hours the three lines were estimated at", async () => {
    expect(figure(await figures(), "Estimated work")).toEqual({
      label: "Estimated work",
      value: "40h",
      note: null,
    });
  });

  it("says nothing has been delivered yet", async () => {
    expect(figure(await figures(), "Delivered")).toEqual({
      label: "Delivered",
      value: "None yet",
      note: "None of 3 deliverables is marked done yet.",
    });
  });

  it("works the contract value out per estimated hour", async () => {
    const rate = figure(await figures(), "Implied hourly rate");
    expect(rate.value).toBe("$100.00/hr");
    expect(rate.note).toContain("$4,000.00 over 40 hours estimated.");
  });
});
