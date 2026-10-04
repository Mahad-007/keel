import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  getDeliverable,
  listDeliverables,
  moveDeliverable,
  setDeliverableStatus,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import type { Deliverable } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import { applyScopeChange, readScopeChange, SCOPE_FIELD_NAMES } from "./arrange";
import { nextDeliverableStatus } from "./status";

/**
 * The seam between the list on screen and the list in the database.
 *
 * The whole point of an optimistic list is that it shows what the write is
 * about to do. If the two ever disagree, the page rearranges itself one way,
 * the server answers with another, and the lines jump — which is worse than
 * waiting for the round trip would have been.
 *
 * Both sides go through `moveOne`, so they agree by construction today. These
 * tests are here for the day somebody changes one of them: a press is applied
 * to a real list and written to a real database, and the two orders are
 * compared.
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

/** A scope list of four, in the order they were written down. */
async function scope(): Promise<Deliverable[]> {
  for (const title of ["Discovery", "Wireframes", "Build", "Launch"]) {
    await createDeliverable({ projectId, title }, db);
  }
  return listDeliverables(projectId, db);
}

function titles(rows: readonly Deliverable[]): string[] {
  return rows.map((row) => row.title);
}

/** What a row's controls submit when one of its move buttons is pressed. */
function pressed(deliverable: Deliverable, direction: string): FormData {
  const form = new FormData();
  form.set(SCOPE_FIELD_NAMES.id, deliverable.id);
  form.set(SCOPE_FIELD_NAMES.from, deliverable.status);
  form.set(SCOPE_FIELD_NAMES.direction, direction);
  return form;
}

function change(deliverable: Deliverable, direction: string) {
  const read = readScopeChange(pressed(deliverable, direction));
  if (read === null) throw new Error("expected the press to read as a change");
  return read;
}

describe("a move on screen and the same move in the database", () => {
  it("agrees about a line moved towards the front", async () => {
    const rows = await scope();
    const build = rows[2];

    const shown = applyScopeChange(rows, change(build, "up"));
    const written = await moveDeliverable(build.id, "up", db);

    expect(titles(shown)).toEqual(["Discovery", "Build", "Wireframes", "Launch"]);
    expect(titles(written ?? [])).toEqual(titles(shown));
  });

  it("agrees about a line moved towards the back", async () => {
    const rows = await scope();
    const discovery = rows[0];

    const shown = applyScopeChange(rows, change(discovery, "down"));
    const written = await moveDeliverable(discovery.id, "down", db);

    expect(titles(written ?? [])).toEqual(titles(shown));
  });

  it("agrees about a press at the end of the list that moves nothing", async () => {
    const rows = await scope();
    const discovery = rows[0];

    const shown = applyScopeChange(rows, change(discovery, "up"));
    const written = await moveDeliverable(discovery.id, "up", db);

    expect(titles(written ?? [])).toEqual(titles(shown));
  });

  it("agrees after a run of presses, the way a list is actually rearranged", async () => {
    let rows = await scope();
    const launch = rows[3];

    for (let press = 0; press < 3; press += 1) {
      rows = [...applyScopeChange(rows, change(launch, "up"))];
      await moveDeliverable(launch.id, "up", db);
    }

    expect(titles(rows)).toEqual(["Launch", "Discovery", "Wireframes", "Build"]);
    expect(titles(await listDeliverables(projectId, db))).toEqual(titles(rows));
  });

  it("leaves the stored positions dense, whatever the screen shows", async () => {
    const rows = await scope();
    await moveDeliverable(rows[3].id, "up", db);

    const stored = await listDeliverables(projectId, db);

    expect(stored.map((row) => row.sortOrder)).toEqual([0, 1, 2, 3]);
  });
});

/** What a row's controls submit when its status button is pressed. */
function statusPress(deliverable: Deliverable): FormData {
  const form = new FormData();
  form.set(SCOPE_FIELD_NAMES.id, deliverable.id);
  form.set(SCOPE_FIELD_NAMES.from, deliverable.status);
  form.set(
    SCOPE_FIELD_NAMES.status,
    nextDeliverableStatus(deliverable.status),
  );
  return form;
}

function statusChange(deliverable: Deliverable) {
  const read = readScopeChange(statusPress(deliverable));
  if (read === null) throw new Error("expected the press to read as a change");
  if (read.kind !== "status") throw new Error("expected a status change");
  return read;
}

describe("a status press on screen and the same press in the database", () => {
  it("agrees about starting a deliverable", async () => {
    const rows = await scope();
    const build = rows[2];

    const change = statusChange(build);
    const shown = applyScopeChange(rows, change);
    const written = await setDeliverableStatus(
      build.id,
      change.from,
      change.status,
      db,
    );

    expect(shown[2].status).toBe("started");
    expect(written?.status).toBe("started");
  });

  it("agrees all the way round the cycle", async () => {
    const rows = await scope();
    let build = rows[2];

    for (let press = 0; press < 4; press += 1) {
      const change = statusChange(build);
      const shown = applyScopeChange([build], change);
      const written = await setDeliverableStatus(
        build.id,
        change.from,
        change.status,
        db,
      );

      expect(written).not.toBeNull();
      expect(written?.status).toBe(shown[0].status);
      build = written as Deliverable;
    }

    expect(build.status).toBe("started");
  });

  it("leaves the order alone, whichever status is pressed", async () => {
    const rows = await scope();
    const change = statusChange(rows[0]);

    const shown = applyScopeChange(rows, change);
    await setDeliverableStatus(rows[0].id, change.from, change.status, db);

    expect(titles(shown)).toEqual(titles(rows));
    expect(titles(await listDeliverables(projectId, db))).toEqual(titles(rows));
  });

  it("refuses a press read from a row that has since been pressed", async () => {
    const rows = await scope();
    const stale = statusChange(rows[0]);
    await setDeliverableStatus(rows[0].id, "pending", "done", db);

    const written = await setDeliverableStatus(
      rows[0].id,
      stale.from,
      stale.status,
      db,
    );

    expect(written).toBeNull();
    expect((await getDeliverable(rows[0].id, db))?.status).toBe("done");
  });
});
