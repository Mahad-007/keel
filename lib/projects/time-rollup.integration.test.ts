import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  listDeliverables,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import { createTimeEntry, listTimeEntries } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { rollUpProject } from "@/lib/time/rollup";

import type { PanelFigure } from "./figure";
import { rollupFigures, rollupRow, type RollupRow } from "./time-rollup";

/**
 * The sentences, over rows a database actually holds.
 *
 * `time-rollup.test.ts` says what each figure and cell reads like given a
 * rollup, and `rollup.integration.test.ts` says the rollup can be taken over
 * real rows. What neither covers is the whole journey the panel makes: two
 * queries, a join on an attribution column, arithmetic, and then the four
 * lines and the table a reader sees. That is what a renamed column or a
 * changed default breaks silently, because every unit test on either side of
 * it still passes.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Engine rewrite" },
    db,
  );
  projectId = project.id;
});

async function deliverable(title: string, estimatedMinutes: number) {
  return createDeliverable({ projectId, title, estimatedMinutes }, db);
}

async function log(
  minutes: number,
  deliverableId: string | null,
  billable = true,
) {
  return createTimeEntry(
    { projectId, deliverableId, minutes, workedOn: "2026-10-17", billable },
    db,
  );
}

/** What the panel reads, from the two queries the page makes. */
async function panel(): Promise<{ figures: PanelFigure[]; rows: RollupRow[] }> {
  const [deliverables, entries] = await Promise.all([
    listDeliverables(projectId, db),
    listTimeEntries(projectId, db),
  ]);
  const rollup = rollUpProject(deliverables, entries);
  return { figures: rollupFigures(rollup), rows: rollup.lines.map(rollupRow) };
}

/** One figure by the label a reader would look for it under. */
function figure(all: readonly PanelFigure[], label: string): PanelFigure {
  const found = all.find((one) => one.label === label);
  if (found === undefined) throw new Error(`no figure labelled ${label}`);
  return found;
}

describe("the rollup panel over rows the database holds", () => {
  it("reads a project running over its estimates", async () => {
    const build = await deliverable("Homepage build", 240);
    const revisions = await deliverable("Revision round", 120);
    await log(300, build.id);
    await log(30, revisions.id);
    await log(45, null);

    const { figures, rows } = await panel();
    expect(figure(figures, "Logged").value).toBe("6h 15m");
    expect(figure(figures, "Estimated").value).toBe("6h");
    expect(figure(figures, "Against the estimate").value).toBe(
      "15m over · 104% of it",
    );
    expect(figure(figures, "Against no deliverable").value).toBe("45m");

    expect(rows).toEqual([
      {
        deliverableId: build.id,
        title: "Homepage build",
        estimated: "4h",
        logged: "5h",
        notChargeable: null,
        against: "1h over · 125% of it",
      },
      {
        deliverableId: revisions.id,
        title: "Revision round",
        estimated: "2h",
        logged: "30m",
        notChargeable: null,
        against: "1h 30m left · 25% of it",
      },
    ]);
  });

  it("reads a delivered line as having come in under", async () => {
    const build = await deliverable("Homepage build", 240);
    await setDeliverableStatus(build.id, "pending", "done", db);
    await log(180, build.id);

    const { rows } = await panel();
    expect(rows[0].against).toBe("1h under · 75% of it");
  });

  it("carries a non-chargeable entry through to the row", async () => {
    const build = await deliverable("Homepage build", 240);
    await log(120, build.id);
    await log(60, build.id, false);

    const { rows, figures } = await panel();
    expect(rows[0].logged).toBe("3h");
    expect(rows[0].notChargeable).toBe("1h not chargeable");
    expect(figure(figures, "Logged").note).toBe(
      "Across 2 entries. 1h not chargeable.",
    );
  });

  it("refuses to compare a line nobody sized", async () => {
    await deliverable("Discovery", 0);
    const [line] = await listDeliverables(projectId, db);
    await log(480, line.id);

    const { rows, figures } = await panel();
    expect(rows[0].estimated).toBe("Not estimated");
    expect(rows[0].against).toBe("No estimate to compare");
    expect(figure(figures, "Against the estimate").value).toBe(
      "No estimate to compare",
    );
  });

  it("sets time against a project that has no scope list at all", async () => {
    await log(90, null);

    const { rows, figures } = await panel();
    expect(rows).toEqual([]);
    expect(figures.map((one) => one.label)).toEqual(["Logged"]);
    expect(figure(figures, "Logged").value).toBe("1h 30m");
    expect(figure(figures, "Logged").note).toBe("Across 1 entry.");
  });
});
