import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import {
  createDeliverable,
  deleteDeliverable,
  getDeliverable,
  listDeliverables,
  moveDeliverable,
  reorderDeliverables,
  setDeliverableStatus,
  updateDeliverable,
} from "./deliverables";
import { createProject, deleteProject } from "./projects";

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

describe("listDeliverables", () => {
  it("returns the deliverables in the order they were added", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    await createDeliverable({ projectId, title: "Design" }, db);
    await createDeliverable({ projectId, title: "Build" }, db);

    const list = await listDeliverables(projectId, db);

    expect(list.map((row) => row.title)).toEqual([
      "Discovery",
      "Design",
      "Build",
    ]);
  });

  it("returns nothing for a project with no scope written down", async () => {
    expect(await listDeliverables(projectId, db)).toEqual([]);
  });

  it("returns nothing for a project that does not exist", async () => {
    expect(await listDeliverables("prj_missing", db)).toEqual([]);
  });

  it("leaves another project's deliverables out", async () => {
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const other = (await createProject({ clientId, name: "Other" }, db)).id;
    await createDeliverable({ projectId, title: "Ours" }, db);
    await createDeliverable({ projectId: other, title: "Theirs" }, db);

    const list = await listDeliverables(projectId, db);

    expect(list.map((row) => row.title)).toEqual(["Ours"]);
  });
});

describe("updateDeliverable", () => {
  it("changes the title and leaves everything else alone", async () => {
    const created = await createDeliverable(
      { projectId, title: "Design", estimatedMinutes: 600, status: "started" },
      db,
    );

    const updated = await updateDeliverable(
      created.id,
      { title: "Design system" },
      db,
    );

    expect(updated?.title).toBe("Design system");
    expect(updated?.estimatedMinutes).toBe(600);
    expect(updated?.status).toBe("started");
    expect(updated?.sortOrder).toBe(created.sortOrder);
  });

  it("re-estimates a deliverable", async () => {
    const created = await createDeliverable(
      { projectId, title: "Design", estimatedMinutes: 600 },
      db,
    );

    const updated = await updateDeliverable(
      created.id,
      { estimatedMinutes: 1_080 },
      db,
    );

    expect(updated?.estimatedMinutes).toBe(1_080);
  });

  it("moves a deliverable to another status", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    const updated = await updateDeliverable(created.id, { status: "done" }, db);

    expect(updated?.status).toBe("done");
  });

  it("clears a description by patching it blank", async () => {
    const created = await createDeliverable(
      { projectId, title: "Build", description: "The old note." },
      db,
    );

    const updated = await updateDeliverable(created.id, { description: "" }, db);

    expect(updated?.description).toBeNull();
  });

  it("returns null for a deliverable that no longer exists", async () => {
    expect(
      await updateDeliverable("dlv_missing", { title: "Anything" }, db),
    ).toBeNull();
  });
});

describe("updateDeliverable with nothing to change", () => {
  it("returns the row unchanged for an empty patch", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    const updated = await updateDeliverable(created.id, {}, db);

    expect(updated).toEqual(created);
  });

  it("leaves updatedAt alone for an empty patch", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await updateDeliverable(created.id, {}, db);

    expect((await getDeliverable(created.id, db))?.updatedAt).toBe(
      created.updatedAt,
    );
  });

  it("returns null for an empty patch against a missing deliverable", async () => {
    expect(await updateDeliverable("dlv_missing", {}, db)).toBeNull();
  });

  it("records that a deliverable was edited when something changed", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);
    await new Promise((resolve) => setTimeout(resolve, 2));

    const updated = await updateDeliverable(created.id, { title: "Ship" }, db);

    expect(updated?.updatedAt).not.toBe(created.updatedAt);
    expect(updated?.createdAt).toBe(created.createdAt);
  });
});

describe("updateDeliverable validation", () => {
  it("refuses to blank out a title", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await expect(
      updateDeliverable(created.id, { title: "  " }, db),
    ).rejects.toThrow(/deliverable title is required/);
    expect((await getDeliverable(created.id, db))?.title).toBe("Build");
  });

  it("refuses an estimate that is not whole minutes", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await expect(
      updateDeliverable(created.id, { estimatedMinutes: 45.5 }, db),
    ).rejects.toThrow(/whole minutes/);
  });

  it("refuses a negative estimate", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await expect(
      updateDeliverable(created.id, { estimatedMinutes: -1 }, db),
    ).rejects.toThrow(/cannot be negative/);
  });

  it("refuses a status that is not one of the three", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await expect(
      updateDeliverable(created.id, { status: "parked" as "done" }, db),
    ).rejects.toThrow(/unknown deliverable status/);
  });

  it("validates before it decides the patch is empty", async () => {
    await expect(
      updateDeliverable("dlv_missing", { title: "" }, db),
    ).rejects.toThrow(/deliverable title is required/);
  });
});

describe("deleteDeliverable", () => {
  it("hands back the row it removed", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    const deleted = await deleteDeliverable(created.id, db);

    expect(deleted).toEqual(created);
    expect(await getDeliverable(created.id, db)).toBeNull();
  });

  it("takes the deliverable out of its project's list", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    const design = await createDeliverable({ projectId, title: "Design" }, db);
    await createDeliverable({ projectId, title: "Build" }, db);

    await deleteDeliverable(design.id, db);

    const list = await listDeliverables(projectId, db);
    expect(list.map((row) => row.title)).toEqual(["Discovery", "Build"]);
  });

  it("returns null for a deliverable that was already gone", async () => {
    expect(await deleteDeliverable("dlv_missing", db)).toBeNull();
  });

  it("leaves the rest of the project's scope alone", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const build = await createDeliverable({ projectId, title: "Build" }, db);

    await deleteDeliverable(discovery.id, db);

    expect((await getDeliverable(build.id, db))?.title).toBe("Build");
  });
});

describe("project cascade", () => {
  it("takes a project's deliverables with it", async () => {
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const doomed = (await createProject({ clientId, name: "Doomed" }, db)).id;
    const kept = await createDeliverable({ projectId, title: "Kept" }, db);
    await createDeliverable({ projectId: doomed, title: "Going" }, db);

    await deleteProject(doomed, db);

    expect(await listDeliverables(doomed, db)).toEqual([]);
    expect(await getDeliverable(kept.id, db)).not.toBeNull();
  });
});

describe("reorderDeliverables", () => {
  /** Three deliverables in their added order, with the ids to rearrange them. */
  async function scope() {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const design = await createDeliverable({ projectId, title: "Design" }, db);
    const build = await createDeliverable({ projectId, title: "Build" }, db);
    return { discovery, design, build };
  }

  it("returns the list in the order it was asked for", async () => {
    const { discovery, design, build } = await scope();

    const list = await reorderDeliverables(
      projectId,
      [build.id, discovery.id, design.id],
      db,
    );

    expect(list.map((row) => row.title)).toEqual([
      "Build",
      "Discovery",
      "Design",
    ]);
  });

  it("writes the order, so the next read agrees with it", async () => {
    const { discovery, design, build } = await scope();

    await reorderDeliverables(projectId, [build.id, design.id, discovery.id], db);

    const list = await listDeliverables(projectId, db);
    expect(list.map((row) => row.title)).toEqual([
      "Build",
      "Design",
      "Discovery",
    ]);
  });

  it("leaves the positions dense from zero", async () => {
    const { discovery, design, build } = await scope();

    const list = await reorderDeliverables(
      projectId,
      [design.id, build.id, discovery.id],
      db,
    );

    expect(list.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
  });

  it("accepts the order the list is already in", async () => {
    const { discovery, design, build } = await scope();

    const list = await reorderDeliverables(
      projectId,
      [discovery.id, design.id, build.id],
      db,
    );

    expect(list.map((row) => row.title)).toEqual([
      "Discovery",
      "Design",
      "Build",
    ]);
  });

  it("has nothing to order in a project with no scope", async () => {
    expect(await reorderDeliverables(projectId, [], db)).toEqual([]);
  });
});

describe("reorderDeliverables refusals", () => {
  async function pair() {
    const first = await createDeliverable({ projectId, title: "First" }, db);
    const second = await createDeliverable({ projectId, title: "Second" }, db);
    return { first, second };
  }

  it("refuses an order that leaves a deliverable out", async () => {
    const { first } = await pair();

    await expect(
      reorderDeliverables(projectId, [first.id], db),
    ).rejects.toThrow(/leaves out deliverables/);
  });

  it("refuses an order that names a deliverable twice", async () => {
    const { first, second } = await pair();

    await expect(
      reorderDeliverables(projectId, [first.id, first.id, second.id], db),
    ).rejects.toThrow(/same deliverable twice/);
  });

  it("refuses an order naming another project's deliverable", async () => {
    const { first, second } = await pair();
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const other = (await createProject({ clientId, name: "Other" }, db)).id;
    const theirs = await createDeliverable({ projectId: other, title: "Theirs" }, db);

    await expect(
      reorderDeliverables(projectId, [first.id, second.id, theirs.id], db),
    ).rejects.toThrow(/not in this project/);
  });

  it("writes nothing when the order is refused", async () => {
    const { first, second } = await pair();

    await expect(
      reorderDeliverables(projectId, [second.id], db),
    ).rejects.toThrow();

    const list = await listDeliverables(projectId, db);
    expect(list.map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it("does not move another project's deliverable", async () => {
    const { first, second } = await pair();
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const other = (await createProject({ clientId, name: "Other" }, db)).id;
    const theirs = await createDeliverable({ projectId: other, title: "Theirs" }, db);

    await reorderDeliverables(projectId, [second.id, first.id], db);

    expect((await getDeliverable(theirs.id, db))?.sortOrder).toBe(
      theirs.sortOrder,
    );
  });
});

describe("moveDeliverable", () => {
  /** Three deliverables in their added order: Discovery, Design, Build. */
  async function scope() {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const design = await createDeliverable({ projectId, title: "Design" }, db);
    const build = await createDeliverable({ projectId, title: "Build" }, db);
    return { discovery, design, build };
  }

  it("moves a deliverable one place up the list", async () => {
    const { build } = await scope();

    const list = await moveDeliverable(build.id, "up", db);

    expect(list?.map((row) => row.title)).toEqual([
      "Discovery",
      "Build",
      "Design",
    ]);
  });

  it("moves a deliverable one place down the list", async () => {
    const { discovery } = await scope();

    const list = await moveDeliverable(discovery.id, "down", db);

    expect(list?.map((row) => row.title)).toEqual([
      "Design",
      "Discovery",
      "Build",
    ]);
  });

  it("writes the move, so the next read agrees with it", async () => {
    const { build } = await scope();

    await moveDeliverable(build.id, "up", db);

    const list = await listDeliverables(projectId, db);
    expect(list.map((row) => row.title)).toEqual([
      "Discovery",
      "Build",
      "Design",
    ]);
  });

  it("keeps the positions dense after a move", async () => {
    const { design } = await scope();

    const list = await moveDeliverable(design.id, "down", db);

    expect(list?.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
  });

  it("returns to where it started after a move and its opposite", async () => {
    const { design } = await scope();

    await moveDeliverable(design.id, "down", db);
    const list = await moveDeliverable(design.id, "up", db);

    expect(list?.map((row) => row.title)).toEqual([
      "Discovery",
      "Design",
      "Build",
    ]);
  });
});

describe("moveDeliverable at the edges", () => {
  it("leaves the first deliverable where it is when moved up", async () => {
    const first = await createDeliverable({ projectId, title: "First" }, db);
    await createDeliverable({ projectId, title: "Second" }, db);

    const list = await moveDeliverable(first.id, "up", db);

    expect(list?.map((row) => row.title)).toEqual(["First", "Second"]);
  });

  it("leaves the last deliverable where it is when moved down", async () => {
    await createDeliverable({ projectId, title: "First" }, db);
    const last = await createDeliverable({ projectId, title: "Second" }, db);

    const list = await moveDeliverable(last.id, "down", db);

    expect(list?.map((row) => row.title)).toEqual(["First", "Second"]);
  });

  it("does not bump updatedAt for a move that changes nothing", async () => {
    const only = await createDeliverable({ projectId, title: "Only" }, db);
    await new Promise((resolve) => setTimeout(resolve, 2));

    await moveDeliverable(only.id, "up", db);

    expect((await getDeliverable(only.id, db))?.updatedAt).toBe(only.updatedAt);
  });

  it("does not record a reordered deliverable as edited", async () => {
    const first = await createDeliverable({ projectId, title: "First" }, db);
    const second = await createDeliverable({ projectId, title: "Second" }, db);
    await new Promise((resolve) => setTimeout(resolve, 2));

    await moveDeliverable(second.id, "up", db);

    expect((await getDeliverable(first.id, db))?.updatedAt).toBe(
      first.updatedAt,
    );
    expect((await getDeliverable(second.id, db))?.updatedAt).toBe(
      second.updatedAt,
    );
  });

  it("returns null for a deliverable that no longer exists", async () => {
    expect(await moveDeliverable("dlv_missing", "up", db)).toBeNull();
  });
});

describe("moveDeliverable across projects", () => {
  it("moves within its own project's list only", async () => {
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const other = (await createProject({ clientId, name: "Other" }, db)).id;
    const ours = await createDeliverable({ projectId, title: "Ours" }, db);
    const alsoOurs = await createDeliverable({ projectId, title: "Also ours" }, db);
    const theirsFirst = await createDeliverable(
      { projectId: other, title: "Theirs first" },
      db,
    );
    const theirsSecond = await createDeliverable(
      { projectId: other, title: "Theirs second" },
      db,
    );

    const list = await moveDeliverable(alsoOurs.id, "up", db);

    expect(list?.map((row) => row.id)).toEqual([alsoOurs.id, ours.id]);
    expect((await getDeliverable(theirsFirst.id, db))?.sortOrder).toBe(0);
    expect((await getDeliverable(theirsSecond.id, db))?.sortOrder).toBe(1);
  });
});

describe("positions after a delete", () => {
  it("closes the gap a deleted deliverable leaves", async () => {
    await createDeliverable({ projectId, title: "Discovery" }, db);
    const design = await createDeliverable({ projectId, title: "Design" }, db);
    await createDeliverable({ projectId, title: "Build" }, db);

    await deleteDeliverable(design.id, db);

    const list = await listDeliverables(projectId, db);
    expect(list.map((row) => row.sortOrder)).toEqual([0, 1]);
  });

  it("keeps the order of what is left", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const design = await createDeliverable({ projectId, title: "Design" }, db);
    const build = await createDeliverable({ projectId, title: "Build" }, db);

    await deleteDeliverable(discovery.id, db);

    const list = await listDeliverables(projectId, db);
    expect(list.map((row) => row.id)).toEqual([design.id, build.id]);
  });

  it("appends the next deliverable after the compacted list", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    await createDeliverable({ projectId, title: "Design" }, db);
    await deleteDeliverable(discovery.id, db);

    const added = await createDeliverable({ projectId, title: "Build" }, db);

    expect(added.sortOrder).toBe(1);
  });

  it("does not record the deliverables it renumbered as edited", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const build = await createDeliverable({ projectId, title: "Build" }, db);
    await new Promise((resolve) => setTimeout(resolve, 2));

    await deleteDeliverable(discovery.id, db);

    expect((await getDeliverable(build.id, db))?.updatedAt).toBe(
      build.updatedAt,
    );
  });

  it("leaves another project's positions alone", async () => {
    const clientId = (await createClient({ name: "Beam Ltd" }, db)).id;
    const other = (await createProject({ clientId, name: "Other" }, db)).id;
    const theirs = await createDeliverable(
      { projectId: other, title: "Theirs" },
      db,
    );
    const ours = await createDeliverable({ projectId, title: "Ours" }, db);

    await deleteDeliverable(ours.id, db);

    expect((await getDeliverable(theirs.id, db))?.sortOrder).toBe(0);
  });
});

describe("setDeliverableStatus", () => {
  it("moves a deliverable to the status asked for", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    const written = await setDeliverableStatus(
      created.id,
      "pending",
      "started",
      db,
    );

    expect(written?.status).toBe("started");
    expect((await getDeliverable(created.id, db))?.status).toBe("started");
  });

  it("leaves the rest of the row alone", async () => {
    const created = await createDeliverable(
      {
        projectId,
        title: "Build",
        description: "The booking flow.",
        estimatedMinutes: 600,
      },
      db,
    );

    const written = await setDeliverableStatus(
      created.id,
      "pending",
      "done",
      db,
    );

    expect(written?.title).toBe("Build");
    expect(written?.description).toBe("The booking flow.");
    expect(written?.estimatedMinutes).toBe(600);
    expect(written?.sortOrder).toBe(created.sortOrder);
    expect(written?.createdAt).toBe(created.createdAt);
  });

  it("records that the deliverable was edited", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);
    await new Promise((resolve) => setTimeout(resolve, 2));

    const written = await setDeliverableStatus(
      created.id,
      "pending",
      "started",
      db,
    );

    expect(written?.updatedAt).not.toBe(created.updatedAt);
  });

  it("leaves the other deliverables on the project alone", async () => {
    const first = await createDeliverable({ projectId, title: "Design" }, db);
    const second = await createDeliverable({ projectId, title: "Build" }, db);

    await setDeliverableStatus(second.id, "pending", "done", db);

    expect((await getDeliverable(first.id, db))?.status).toBe("pending");
  });
});

describe("setDeliverableStatus against a row that has moved on", () => {
  it("writes nothing when the deliverable is in another status", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);
    await setDeliverableStatus(created.id, "pending", "done", db);

    const second = await setDeliverableStatus(
      created.id,
      "pending",
      "started",
      db,
    );

    expect(second).toBeNull();
    expect((await getDeliverable(created.id, db))?.status).toBe("done");
  });

  it("leaves updatedAt alone when it refuses", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);
    const done = await setDeliverableStatus(created.id, "pending", "done", db);
    await new Promise((resolve) => setTimeout(resolve, 2));

    await setDeliverableStatus(created.id, "started", "done", db);

    expect((await getDeliverable(created.id, db))?.updatedAt).toBe(
      done?.updatedAt,
    );
  });

  it("returns null for a deliverable that no longer exists", async () => {
    expect(
      await setDeliverableStatus("dlv_missing", "pending", "done", db),
    ).toBeNull();
  });

  it("refuses a status the column is not allowed to hold", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await expect(
      setDeliverableStatus(created.id, "pending", "shipped" as "done", db),
    ).rejects.toThrow(/unknown deliverable status/);
    expect((await getDeliverable(created.id, db))?.status).toBe("pending");
  });

  it("refuses to be asked for a status the row could not have been in", async () => {
    const created = await createDeliverable({ projectId, title: "Build" }, db);

    await expect(
      setDeliverableStatus(created.id, "shipped" as "done", "done", db),
    ).rejects.toThrow(/unknown deliverable status/);
  });
});
