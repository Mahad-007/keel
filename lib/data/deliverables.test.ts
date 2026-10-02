import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createDeliverable, getDeliverable } from "./deliverables";
import { createProject } from "./projects";

let db: Database;
/** Every deliverable needs a project, so each test starts with one. */
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Anvil Co" }, db)).id;
  projectId = (await createProject({ clientId, name: "Rebuild" }, db)).id;
});

describe("createDeliverable", () => {
  it("stores the deliverable and hands back the saved row", async () => {
    const deliverable = await createDeliverable(
      {
        projectId,
        title: "Design system",
        description: "Tokens, type scale, and the component inventory.",
        estimatedMinutes: 1_200,
        status: "started",
      },
      db,
    );

    expect(deliverable.id).toMatch(/^dlv_/);
    expect(deliverable.projectId).toBe(projectId);
    expect(deliverable.title).toBe("Design system");
    expect(deliverable.description).toBe(
      "Tokens, type scale, and the component inventory.",
    );
    expect(deliverable.estimatedMinutes).toBe(1_200);
    expect(deliverable.status).toBe("started");
  });

  it("defaults a deliverable to pending with nothing estimated", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Content migration" },
      db,
    );

    expect(deliverable.status).toBe("pending");
    expect(deliverable.estimatedMinutes).toBe(0);
    expect(deliverable.description).toBeNull();
  });

  it("collapses a blank description to NULL rather than storing spaces", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Launch", description: "   " },
      db,
    );

    expect(deliverable.description).toBeNull();
  });

  it("trims the title and the description it was given", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "  Analytics  ", description: "  Two events.  " },
      db,
    );

    expect(deliverable.title).toBe("Analytics");
    expect(deliverable.description).toBe("Two events.");
  });

  it("stamps both timestamps on a new deliverable", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Launch" },
      db,
    );

    expect(deliverable.createdAt).not.toBe("");
    expect(deliverable.updatedAt).toBe(deliverable.createdAt);
  });
});

describe("createDeliverable positions", () => {
  it("starts the first deliverable at the top of the list", async () => {
    const first = await createDeliverable({ projectId, title: "One" }, db);

    expect(first.sortOrder).toBe(0);
  });

  it("appends each new deliverable after the last", async () => {
    const first = await createDeliverable({ projectId, title: "One" }, db);
    const second = await createDeliverable({ projectId, title: "Two" }, db);
    const third = await createDeliverable({ projectId, title: "Three" }, db);

    expect([first.sortOrder, second.sortOrder, third.sortOrder]).toEqual([
      0, 1, 2,
    ]);
  });

  it("counts positions per project, not across the table", async () => {
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const other = (await createProject({ clientId, name: "Other" }, db)).id;
    await createDeliverable({ projectId, title: "Ours" }, db);

    const theirs = await createDeliverable({ projectId: other, title: "Theirs" }, db);

    expect(theirs.sortOrder).toBe(0);
  });
});

describe("createDeliverable validation", () => {
  it("refuses a deliverable with no title", async () => {
    await expect(
      createDeliverable({ projectId, title: "   " }, db),
    ).rejects.toThrow(/deliverable title is required/);
  });

  it("refuses an estimate that is not whole minutes", async () => {
    await expect(
      createDeliverable({ projectId, title: "Launch", estimatedMinutes: 90.5 }, db),
    ).rejects.toThrow(/whole minutes/);
  });

  it("refuses a negative estimate", async () => {
    await expect(
      createDeliverable({ projectId, title: "Launch", estimatedMinutes: -30 }, db),
    ).rejects.toThrow(/cannot be negative/);
  });

  it("refuses a status that is not one of the three", async () => {
    await expect(
      createDeliverable(
        { projectId, title: "Launch", status: "shipped" as "done" },
        db,
      ),
    ).rejects.toThrow(/unknown deliverable status/);
  });

  it("names the project id when there is no such project", async () => {
    await expect(
      createDeliverable({ projectId: "prj_missing", title: "Launch" }, db),
    ).rejects.toThrow(/no project with id prj_missing/);
  });

  it("refuses a blank project id without going to the database", async () => {
    await expect(
      createDeliverable({ projectId: "  ", title: "Launch" }, db),
    ).rejects.toThrow(/deliverable project is required/);
  });

  it("writes nothing when a deliverable is refused", async () => {
    await expect(
      createDeliverable({ projectId, title: "" }, db),
    ).rejects.toThrow();

    const kept = await createDeliverable({ projectId, title: "First" }, db);
    expect(kept.sortOrder).toBe(0);
  });
});

describe("getDeliverable", () => {
  it("reads back the row that was written", async () => {
    const created = await createDeliverable(
      { projectId, title: "Design system", estimatedMinutes: 600 },
      db,
    );

    const found = await getDeliverable(created.id, db);

    expect(found).toEqual(created);
  });

  it("returns null for an id that was never written", async () => {
    expect(await getDeliverable("dlv_missing", db)).toBeNull();
  });
});
