import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  deleteDeliverable,
  listDeliverables,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import type { Deliverable } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import { announceScopeChange, applyScopeChange } from "./arrange";
import { deletedAnnouncement, rowAfterDelete } from "./remove";

/**
 * The seam between a deletion on screen and the same deletion in the database.
 *
 * The list takes the row out immediately and the write follows, so the two have
 * to end up with the same lines in the same order — and the sentence said out
 * loud has to count the same list the server will send back. A count that
 * disagrees is worse than no count: it is the page telling a reader who cannot
 * see the list something untrue about it.
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

async function scope(): Promise<Deliverable[]> {
  for (const title of ["Discovery", "Wireframes", "Build", "Launch"]) {
    await createDeliverable({ projectId, title }, db);
  }
  return listDeliverables(projectId, db);
}

function titles(rows: readonly Deliverable[]): string[] {
  return rows.map((row) => row.title);
}

describe("a deletion on screen and the same deletion in the database", () => {
  it("agrees about what is left, and in what order", async () => {
    const rows = await scope();
    const build = rows[2];

    const shown = applyScopeChange(rows, { kind: "remove", id: build.id });
    await deleteDeliverable(build.id, db);

    expect(titles(shown)).toEqual(["Discovery", "Wireframes", "Launch"]);
    expect(titles(await listDeliverables(projectId, db))).toEqual(
      titles(shown),
    );
  });

  it("agrees when the first line goes", async () => {
    const rows = await scope();
    const shown = applyScopeChange(rows, { kind: "remove", id: rows[0].id });
    await deleteDeliverable(rows[0].id, db);

    expect(titles(await listDeliverables(projectId, db))).toEqual(
      titles(shown),
    );
  });

  it("agrees when the last line goes", async () => {
    const rows = await scope();
    const shown = applyScopeChange(rows, { kind: "remove", id: rows[3].id });
    await deleteDeliverable(rows[3].id, db);

    expect(titles(await listDeliverables(projectId, db))).toEqual(
      titles(shown),
    );
  });

  it("agrees that the list is empty once the only line goes", async () => {
    const only = await createDeliverable({ projectId, title: "Discovery" }, db);
    const shown = applyScopeChange([only], { kind: "remove", id: only.id });
    await deleteDeliverable(only.id, db);

    expect(shown).toEqual([]);
    expect(await listDeliverables(projectId, db)).toEqual([]);
  });
});

describe("the sentence a deletion says out loud", () => {
  it("counts the list the server goes on to send back", async () => {
    const rows = await scope();
    const said = announceScopeChange(rows, {
      kind: "remove",
      id: rows[1].id,
    });

    await deleteDeliverable(rows[1].id, db);
    const left = await listDeliverables(projectId, db);

    expect(said).toBe(deletedAnnouncement("Wireframes", left.length));
  });
});

describe("the line the cursor moves to", () => {
  it("is one the list still has", async () => {
    const rows = await scope();
    const next = rowAfterDelete(
      rows.map((row) => row.id),
      rows[2].id,
    );

    await deleteDeliverable(rows[2].id, db);
    const left = await listDeliverables(projectId, db);

    expect(left.map((row) => row.id)).toContain(next);
  });

  it("is nothing at all once the list is empty", async () => {
    const only = await createDeliverable({ projectId, title: "Discovery" }, db);
    expect(rowAfterDelete([only.id], only.id)).toBeNull();

    await deleteDeliverable(only.id, db);
    expect(await listDeliverables(projectId, db)).toEqual([]);
  });
});
