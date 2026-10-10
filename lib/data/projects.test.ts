import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { ProjectStatus } from "@/lib/projects/status";
import { TRANSITION_REASON_LIMIT } from "@/lib/projects/transitions";
import { createTestDb } from "@/lib/db/testing";

import { archiveClient, createClient } from "./clients";
import { createDeliverable, listDeliverables } from "./deliverables";
import { listProjectStatusEvents } from "./project-status-events";
import {
  countProjectsByStatus,
  createProject,
  deleteProject,
  duplicateProject,
  getProject,
  getProjectWithClient,
  listProjects,
  listProjectsForClient,
  listProjectsWithClient,
  type ProjectPatch,
  transitionProject,
  updateProject,
} from "./projects";

let db: Database;
/** Every project needs a client, so each test starts with one to hang off. */
let clientId: string;

/**
 * `createdAt` comes from the wall clock, so two projects created in the same
 * millisecond would tie and an ordering test would pass or fail by luck.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

beforeEach(async () => {
  db = await createTestDb();
  clientId = (await createClient({ name: "Anvil Co" }, db)).id;
});

describe("createProject", () => {
  it("stores the project and hands back the saved row", async () => {
    const project = await createProject(
      {
        clientId,
        name: "Website rebuild",
        status: "active",
        contractValueCents: 1_200_000,
        rateCents: 15_000,
      },
      db,
    );

    expect(project.id).toMatch(/^prj_/);
    expect(project.clientId).toBe(clientId);
    expect(project.name).toBe("Website rebuild");
    expect(project.status).toBe("active");
    expect(project.contractValueCents).toBe(1_200_000);
    expect(project.rateCents).toBe(15_000);
  });

  it("defaults a project to a draft with nothing agreed yet", async () => {
    const project = await createProject({ clientId, name: "Sketch" }, db);

    expect(project.status).toBe("draft");
    expect(project.contractValueCents).toBe(0);
    expect(project.startedAt).toBeNull();
    expect(project.closedAt).toBeNull();
  });

  it("leaves the rate override null rather than zero when absent", async () => {
    const project = await createProject({ clientId, name: "Client rate" }, db);

    expect(project.rateCents).toBeNull();
  });

  it("keeps a deliberate zero override distinct from no override", async () => {
    const project = await createProject(
      { clientId, name: "Pro bono", rateCents: 0 },
      db,
    );

    expect(project.rateCents).toBe(0);
  });

  it("trims the name and refuses one that is only whitespace", async () => {
    const project = await createProject(
      { clientId, name: "  Brand refresh  " },
      db,
    );
    expect(project.name).toBe("Brand refresh");

    await expect(
      createProject({ clientId, name: "   " }, db),
    ).rejects.toThrow(/project name/);
  });

  it("refuses money that is not whole, non-negative cents", async () => {
    await expect(
      createProject({ clientId, name: "Fractional", contractValueCents: 1.5 }, db),
    ).rejects.toThrow(/whole cents/);
    await expect(
      createProject({ clientId, name: "Negative", contractValueCents: -1 }, db),
    ).rejects.toThrow(/negative/);
    await expect(
      createProject({ clientId, name: "Odd override", rateCents: 99.9 }, db),
    ).rejects.toThrow(/whole cents/);
  });

  it("refuses a contract value too large to be stored exactly", async () => {
    await expect(
      createProject(
        {
          clientId,
          name: "Fortune",
          contractValueCents: Number.MAX_SAFE_INTEGER + 2,
        },
        db,
      ),
    ).rejects.toThrow(/whole cents/);
    expect(await listProjects(db)).toEqual([]);
  });

  it("refuses a status outside the four the schema allows", async () => {
    await expect(
      createProject(
        { clientId, name: "Archived?", status: "archived" as ProjectStatus },
        db,
      ),
    ).rejects.toThrow(/unknown project status/);
  });

  it("refuses a project hung off a client that does not exist", async () => {
    await expect(
      createProject({ clientId: "cli_nope", name: "Orphan" }, db),
    ).rejects.toThrow(/no client with id cli_nope/);
  });

  it("refuses a project with no client at all", async () => {
    await expect(
      createProject({ clientId: "  ", name: "Unattached" }, db),
    ).rejects.toThrow(/project client/);
  });

  it("dates the start of a project created as active", async () => {
    const project = await createProject(
      { clientId, name: "Started today", status: "active" },
      db,
    );

    expect(project.startedAt).not.toBeNull();
    expect(project.startedAt).toBe(new Date(project.startedAt!).toISOString());
    expect(project.closedAt).toBeNull();
  });

  it("dates the close of an engagement recorded after it ended", async () => {
    const project = await createProject(
      { clientId, name: "Historic", status: "closed" },
      db,
    );

    expect(project.closedAt).not.toBeNull();
    expect(project.startedAt).toBeNull();
  });

  it("gives a paused project neither date, having never run", async () => {
    const project = await createProject(
      { clientId, name: "On hold", status: "paused" },
      db,
    );

    expect(project.startedAt).toBeNull();
    expect(project.closedAt).toBeNull();
  });

  it("gives every project a distinct id", async () => {
    const a = await createProject({ clientId, name: "One" }, db);
    const b = await createProject({ clientId, name: "Two" }, db);

    expect(a.id).not.toBe(b.id);
  });

  it("timestamps rows as ISO strings", async () => {
    const project = await createProject({ clientId, name: "Timestamped" }, db);

    expect(project.createdAt).toBe(new Date(project.createdAt).toISOString());
    expect(project.updatedAt).toBe(project.createdAt);
  });
});

describe("getProject", () => {
  it("finds the row the create call returned", async () => {
    const project = await createProject(
      { clientId, name: "Findable", contractValueCents: 500_000 },
      db,
    );

    expect(await getProject(project.id, db)).toEqual(project);
  });

  it("returns null for an id that was never issued", async () => {
    expect(await getProject("prj_nope", db)).toBeNull();
  });
});

describe("listProjects", () => {
  it("is empty before anything is created", async () => {
    expect(await listProjects(db)).toEqual([]);
  });

  it("puts the most recently created project first", async () => {
    await createProject({ clientId, name: "First" }, db);
    await tick();
    await createProject({ clientId, name: "Second" }, db);

    expect((await listProjects(db)).map((p) => p.name)).toEqual([
      "Second",
      "First",
    ]);
  });

  it("holds projects for every client, not one", async () => {
    const other = await createClient({ name: "Beacon Ltd" }, db);
    await createProject({ clientId, name: "Ours" }, db);
    await createProject({ clientId: other.id, name: "Theirs" }, db);

    expect(await listProjects(db)).toHaveLength(2);
  });

  it("includes closed projects, which are still part of the record", async () => {
    await createProject({ clientId, name: "Done", status: "closed" }, db);

    expect((await listProjects(db)).map((p) => p.name)).toEqual(["Done"]);
  });
});

describe("listProjectsForClient", () => {
  it("holds only that client's projects", async () => {
    const other = await createClient({ name: "Beacon Ltd" }, db);
    const ours = await createProject({ clientId, name: "Ours" }, db);
    await createProject({ clientId: other.id, name: "Theirs" }, db);

    expect((await listProjectsForClient(clientId, db)).map((p) => p.id)).toEqual(
      [ours.id],
    );
  });

  it("puts the most recent of them first", async () => {
    await createProject({ clientId, name: "Old work" }, db);
    await tick();
    await createProject({ clientId, name: "New work" }, db);

    expect(
      (await listProjectsForClient(clientId, db)).map((p) => p.name),
    ).toEqual(["New work", "Old work"]);
  });

  it("is empty for a client with no projects yet", async () => {
    const quiet = await createClient({ name: "Quiet Co" }, db);

    expect(await listProjectsForClient(quiet.id, db)).toEqual([]);
  });

  it("is empty for a client that does not exist, rather than throwing", async () => {
    expect(await listProjectsForClient("cli_nope", db)).toEqual([]);
  });
});

describe("updateProject", () => {
  it("changes only the fields in the patch", async () => {
    const project = await createProject(
      {
        clientId,
        name: "Before",
        contractValueCents: 800_000,
        rateCents: 12_000,
      },
      db,
    );

    const updated = await updateProject(project.id, { name: "After" }, db);

    expect(updated?.name).toBe("After");
    expect(updated?.contractValueCents).toBe(800_000);
    expect(updated?.rateCents).toBe(12_000);
    expect(updated?.clientId).toBe(clientId);
    expect(updated?.createdAt).toBe(project.createdAt);
  });

  it("raises the contract value when more work is agreed", async () => {
    const project = await createProject(
      { clientId, name: "Growing", contractValueCents: 500_000 },
      db,
    );

    const updated = await updateProject(
      project.id,
      { contractValueCents: 750_000 },
      db,
    );

    expect(updated?.contractValueCents).toBe(750_000);
  });

  it("leaves the row untouched when the patch is empty", async () => {
    const project = await createProject({ clientId, name: "Unchanged" }, db);

    expect(await updateProject(project.id, {}, db)).toEqual(project);
  });

  it("returns null for a project that does not exist", async () => {
    expect(await updateProject("prj_nope", { name: "Ghost" }, db)).toBeNull();
    expect(await updateProject("prj_nope", {}, db)).toBeNull();
  });

  it("rejects an invalid patch without writing any of it", async () => {
    const project = await createProject(
      { clientId, name: "Valid", contractValueCents: 400_000 },
      db,
    );

    await expect(
      updateProject(project.id, { name: "  " }, db),
    ).rejects.toThrow(/project name/);
    await expect(
      updateProject(
        project.id,
        { name: "Renamed", contractValueCents: -5 },
        db,
      ),
    ).rejects.toThrow(/negative/);

    expect(await getProject(project.id, db)).toEqual(project);
  });

  it("moves updatedAt forward without touching createdAt", async () => {
    const project = await createProject({ clientId, name: "Touch" }, db);
    await tick();

    const updated = await updateProject(project.id, { name: "Touched" }, db);

    expect(updated!.updatedAt > project.updatedAt).toBe(true);
    expect(updated?.createdAt).toBe(project.createdAt);
  });
});

/**
 * The rate override is the one nullable money column in the table, and the
 * difference between its three states is a billing decision: null defers to
 * the client, zero bills nothing, and a figure overrides.
 */
describe("updateProject on the rate override", () => {
  it("sets an override on a project that was billing at the client rate", async () => {
    const project = await createProject({ clientId, name: "Standard" }, db);

    const updated = await updateProject(project.id, { rateCents: 18_000 }, db);

    expect(updated?.rateCents).toBe(18_000);
  });

  it("clears an override back to the client's rate", async () => {
    const project = await createProject(
      { clientId, name: "Overridden", rateCents: 18_000 },
      db,
    );

    const updated = await updateProject(project.id, { rateCents: null }, db);

    expect(updated?.rateCents).toBeNull();
  });

  it("keeps an override of zero rather than reading it as absent", async () => {
    const project = await createProject(
      { clientId, name: "Goodwill", rateCents: 18_000 },
      db,
    );

    const updated = await updateProject(project.id, { rateCents: 0 }, db);

    expect(updated?.rateCents).toBe(0);
  });
});

describe("createProject and the status trail", () => {
  it("opens the trail with an event that has nothing before it", async () => {
    const project = await createProject({ clientId, name: "Kickoff" }, db);

    const [opening] = await listProjectStatusEvents(project.id, db);

    expect(opening.fromStatus).toBeNull();
    expect(opening.toStatus).toBe("draft");
  });

  it("writes exactly one event, not one per column", async () => {
    const project = await createProject({ clientId, name: "Kickoff" }, db);

    expect(await listProjectStatusEvents(project.id, db)).toHaveLength(1);
  });

  it("records the status a project was created in, not the default", async () => {
    const project = await createProject(
      { clientId, name: "Historic", status: "closed" },
      db,
    );

    const [opening] = await listProjectStatusEvents(project.id, db);

    expect(opening.toStatus).toBe("closed");
  });

  it("writes no trail for a project that was refused", async () => {
    await expect(
      createProject({ clientId, name: "   " }, db),
    ).rejects.toThrow(/required/);

    expect(await listProjects(db)).toEqual([]);
  });
});

describe("updateProject on the status", () => {
  /**
   * The compiler refuses a status in a patch, which is the real guard. This
   * proves the runtime agrees: a crafted object reaching the data layer past
   * the type gets its status ignored rather than written, so the only way a
   * project changes status stays `transitionProject`.
   */
  it("ignores a status smuggled past the type", async () => {
    const project = await createProject({ clientId, name: "Kickoff" }, db);

    await updateProject(
      project.id,
      { status: "closed" } as unknown as ProjectPatch,
      db,
    );

    expect((await getProject(project.id, db))?.status).toBe("draft");
  });

  it("writes no line of history when it was asked to", async () => {
    const project = await createProject({ clientId, name: "Kickoff" }, db);

    await updateProject(
      project.id,
      { status: "active" } as unknown as ProjectPatch,
      db,
    );

    expect(await listProjectStatusEvents(project.id, db)).toHaveLength(1);
  });

  it("still saves the fields it is allowed to touch alongside it", async () => {
    const project = await createProject({ clientId, name: "Kickoff" }, db);

    const updated = await updateProject(
      project.id,
      { name: "Renamed", status: "closed" } as unknown as ProjectPatch,
      db,
    );

    expect(updated?.name).toBe("Renamed");
    expect(updated?.status).toBe("draft");
  });
});

describe("updateProject on the client", () => {
  it("moves the project onto the other client's list", async () => {
    const other = await createClient({ name: "Beacon Ltd" }, db);
    const project = await createProject({ clientId, name: "Misfiled" }, db);

    const moved = await updateProject(project.id, { clientId: other.id }, db);

    expect(moved?.clientId).toBe(other.id);
    expect(await listProjectsForClient(clientId, db)).toEqual([]);
    expect((await listProjectsForClient(other.id, db)).map((p) => p.id)).toEqual(
      [project.id],
    );
  });

  it("refuses a client that does not exist and writes nothing", async () => {
    const project = await createProject({ clientId, name: "Stays put" }, db);

    await expect(
      updateProject(project.id, { clientId: "cli_nope" }, db),
    ).rejects.toThrow(/no client with id cli_nope/);
    expect(await getProject(project.id, db)).toEqual(project);
  });

  it("refuses to unhook a project from any client at all", async () => {
    const project = await createProject({ clientId, name: "Attached" }, db);

    await expect(
      updateProject(project.id, { clientId: "  " }, db),
    ).rejects.toThrow(/project client/);
  });
});

describe("deleteProject", () => {
  it("hands back the row it removed", async () => {
    const project = await createProject(
      { clientId, name: "Typo", contractValueCents: 100_000 },
      db,
    );

    expect(await deleteProject(project.id, db)).toEqual(project);
  });

  it("takes the project off both lists", async () => {
    const project = await createProject({ clientId, name: "Mistake" }, db);

    await deleteProject(project.id, db);

    expect(await listProjects(db)).toEqual([]);
    expect(await listProjectsForClient(clientId, db)).toEqual([]);
    expect(await getProject(project.id, db)).toBeNull();
  });

  it("leaves the client and its other projects alone", async () => {
    const kept = await createProject({ clientId, name: "Real work" }, db);
    const doomed = await createProject({ clientId, name: "Duplicate" }, db);

    await deleteProject(doomed.id, db);

    expect((await listProjectsForClient(clientId, db)).map((p) => p.id)).toEqual(
      [kept.id],
    );
  });

  it("returns null for a project that does not exist", async () => {
    expect(await deleteProject("prj_nope", db)).toBeNull();
  });

  it("is safe to repeat, the second call finding nothing to delete", async () => {
    const project = await createProject({ clientId, name: "Once" }, db);

    expect(await deleteProject(project.id, db)).not.toBeNull();
    expect(await deleteProject(project.id, db)).toBeNull();
  });
});

/**
 * Archiving a client is a soft delete, so their projects keep pointing at a row
 * that is still there. Nothing about a project changes when its client is
 * archived — the work happened, and its record has to stay readable.
 */
describe("projects of an archived client", () => {
  it("stay exactly as they were", async () => {
    const project = await createProject(
      { clientId, name: "Finished work", status: "closed" },
      db,
    );

    await archiveClient(clientId, db);

    expect(await getProject(project.id, db)).toEqual(project);
    expect((await listProjectsForClient(clientId, db)).map((p) => p.id)).toEqual(
      [project.id],
    );
  });

  it("can still be created, because the client row is still there", async () => {
    await archiveClient(clientId, db);

    const project = await createProject({ clientId, name: "Late arrival" }, db);

    expect(project.clientId).toBe(clientId);
  });
});

describe("getProjectWithClient", () => {
  it("returns the project with its client's name attached", async () => {
    const project = await createProject(
      {
        clientId,
        name: "Website rebuild",
        status: "active",
        contractValueCents: 1_200_000,
        rateCents: 15_000,
      },
      db,
    );

    expect(await getProjectWithClient(project.id, db)).toEqual({
      ...project,
      clientName: "Anvil Co",
      clientArchivedAt: null,
    });
  });

  it("returns null for an id no project has", async () => {
    expect(await getProjectWithClient("prj_nope", db)).toBeNull();
  });

  it("picks out the one project asked for, not the newest", async () => {
    const first = await createProject({ clientId, name: "First" }, db);
    await tick();
    await createProject({ clientId, name: "Second" }, db);

    const row = await getProjectWithClient(first.id, db);

    expect(row?.name).toBe("First");
  });

  it("still finds a project whose client has been archived", async () => {
    const project = await createProject({ clientId, name: "Old job" }, db);
    await archiveClient(clientId, db);

    const row = await getProjectWithClient(project.id, db);

    expect(row?.clientName).toBe("Anvil Co");
    expect(row?.clientArchivedAt).not.toBeNull();
  });
});

describe("listProjectsWithClient", () => {
  it("spells out the client every project belongs to", async () => {
    const other = await createClient({ name: "Beam Ltd" }, db);
    await createProject({ clientId, name: "Anvil site" }, db);
    await tick();
    await createProject({ clientId: other.id, name: "Beam app" }, db);

    const rows = await listProjectsWithClient({}, db);

    expect(rows.map((row) => [row.name, row.clientName])).toEqual([
      ["Beam app", "Beam Ltd"],
      ["Anvil site", "Anvil Co"],
    ]);
  });

  it("carries every project column through the join", async () => {
    const project = await createProject(
      {
        clientId,
        name: "Website rebuild",
        status: "active",
        contractValueCents: 1_200_000,
        rateCents: 15_000,
      },
      db,
    );

    const [row] = await listProjectsWithClient({}, db);

    expect(row).toEqual({
      ...project,
      clientName: "Anvil Co",
      clientArchivedAt: null,
    });
  });

  it("returns nothing at all when there are no projects", async () => {
    expect(await listProjectsWithClient({}, db)).toEqual([]);
  });
});

describe("listProjectsWithClient filtered by status", () => {
  /** One project per status, so a filter can be checked to pick out exactly one. */
  async function oneOfEachStatus(): Promise<void> {
    for (const status of ["draft", "active", "paused", "closed"] as const) {
      await createProject({ clientId, name: `A ${status} one`, status }, db);
      await tick();
    }
  }

  it("returns only the projects in the status asked for", async () => {
    await oneOfEachStatus();

    const rows = await listProjectsWithClient({ status: "paused" }, db);

    expect(rows.map((row) => row.name)).toEqual(["A paused one"]);
  });

  it("returns every status when none is asked for", async () => {
    await oneOfEachStatus();

    const rows = await listProjectsWithClient({}, db);

    expect(rows).toHaveLength(4);
  });

  it("returns an empty list for a status nothing is in", async () => {
    await createProject({ clientId, name: "Only a draft" }, db);

    expect(await listProjectsWithClient({ status: "closed" }, db)).toEqual([]);
  });

  it("keeps the join and the ordering while filtering", async () => {
    await createProject({ clientId, name: "First", status: "active" }, db);
    await tick();
    await createProject({ clientId, name: "Second", status: "active" }, db);

    const rows = await listProjectsWithClient({ status: "active" }, db);

    expect(rows.map((row) => [row.name, row.clientName])).toEqual([
      ["Second", "Anvil Co"],
      ["First", "Anvil Co"],
    ]);
  });
});

describe("listProjectsWithClient ordering", () => {
  /**
   * Three projects created in a known order, with the oldest then touched so
   * that created order and updated order genuinely disagree — otherwise a sort
   * by the wrong column passes.
   */
  async function threeInOrder(): Promise<string[]> {
    const first = await createProject({ clientId, name: "First" }, db);
    await tick();
    const second = await createProject({ clientId, name: "Second" }, db);
    await tick();
    const third = await createProject({ clientId, name: "Third" }, db);
    await tick();
    await updateProject(first.id, { name: "First, revised" }, db);
    return [first.id, second.id, third.id];
  }

  it("defaults to newest created first", async () => {
    await threeInOrder();

    const rows = await listProjectsWithClient({}, db);

    expect(rows.map((row) => row.name)).toEqual([
      "Third",
      "Second",
      "First, revised",
    ]);
  });

  it("reads oldest created first when asked to ascend", async () => {
    await threeInOrder();

    const rows = await listProjectsWithClient(
      { sort: { column: "created", direction: "asc" } },
      db,
    );

    expect(rows.map((row) => row.name)).toEqual([
      "First, revised",
      "Second",
      "Third",
    ]);
  });

  it("puts the most recently touched project first when sorting by updated", async () => {
    await threeInOrder();

    const rows = await listProjectsWithClient(
      { sort: { column: "updated", direction: "desc" } },
      db,
    );

    expect(rows.map((row) => row.name)).toEqual([
      "First, revised",
      "Third",
      "Second",
    ]);
  });

  it("puts the stalest project first when sorting by updated ascending", async () => {
    await threeInOrder();

    const rows = await listProjectsWithClient(
      { sort: { column: "updated", direction: "asc" } },
      db,
    );

    expect(rows.map((row) => row.name)).toEqual([
      "Second",
      "Third",
      "First, revised",
    ]);
  });
});

describe("listProjectsWithClient ties", () => {
  /**
   * Two projects stamped with the same instant. Written through Drizzle rather
   * than the data layer because the data layer takes its timestamps from the
   * wall clock, and a tie that only sometimes happens is a test that only
   * sometimes tests anything.
   */
  async function twoAtTheSameInstant(): Promise<void> {
    const stamp = "2026-03-01T09:00:00.000Z";
    for (const name of ["Alpha", "Beta"]) {
      const project = await createProject({ clientId, name }, db);
      await db
        .update(projects)
        .set({ createdAt: stamp, updatedAt: stamp })
        .where(eq(projects.id, project.id));
    }
  }

  it("breaks a created tie on the id, descending with the sort", async () => {
    await twoAtTheSameInstant();

    const rows = await listProjectsWithClient({}, db);
    const ids = rows.map((row) => row.id);

    expect(ids).toEqual([...ids].sort().reverse());
  });

  it("breaks the same tie the other way when ascending", async () => {
    await twoAtTheSameInstant();

    const rows = await listProjectsWithClient(
      { sort: { column: "created", direction: "asc" } },
      db,
    );
    const ids = rows.map((row) => row.id);

    expect(ids).toEqual([...ids].sort());
  });

  it("orders identically on repeated reads of a tied list", async () => {
    await twoAtTheSameInstant();

    const first = await listProjectsWithClient({ sort: { column: "updated", direction: "desc" } }, db);
    const second = await listProjectsWithClient({ sort: { column: "updated", direction: "desc" } }, db);

    expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
  });
});

describe("listProjectsWithClient and archived clients", () => {
  it("keeps the projects of a client who has left the books", async () => {
    await createProject({ clientId, name: "Work that happened" }, db);
    await archiveClient(clientId, db);

    const rows = await listProjectsWithClient({}, db);

    expect(rows.map((row) => row.name)).toEqual(["Work that happened"]);
  });

  it("reports when the joined client is archived, so the list can say so", async () => {
    const other = await createClient({ name: "Beam Ltd" }, db);
    await createProject({ clientId, name: "Anvil site" }, db);
    await tick();
    await createProject({ clientId: other.id, name: "Beam app" }, db);
    await archiveClient(other.id, db);

    const rows = await listProjectsWithClient({}, db);

    expect(
      rows.map((row) => [row.clientName, row.clientArchivedAt === null]),
    ).toEqual([
      ["Beam Ltd", false],
      ["Anvil Co", true],
    ]);
  });
});

describe("countProjectsByStatus", () => {
  it("counts zero of everything on an empty table", async () => {
    expect(await countProjectsByStatus(db)).toEqual({
      draft: 0,
      active: 0,
      paused: 0,
      closed: 0,
    });
  });

  it("counts the projects in each status", async () => {
    await createProject({ clientId, name: "One", status: "active" }, db);
    await createProject({ clientId, name: "Two", status: "active" }, db);
    await createProject({ clientId, name: "Three", status: "closed" }, db);

    expect(await countProjectsByStatus(db)).toEqual({
      draft: 0,
      active: 2,
      paused: 0,
      closed: 1,
    });
  });

  it("keeps a status at zero rather than leaving it out", async () => {
    await createProject({ clientId, name: "Only draft" }, db);

    const counts = await countProjectsByStatus(db);

    expect(Object.keys(counts).sort()).toEqual([
      "active",
      "closed",
      "draft",
      "paused",
    ]);
    expect(counts.paused).toBe(0);
  });
});

describe("countProjectsByStatus after a status change", () => {
  it("moves a project from its old status to its new one", async () => {
    const project = await createProject({ clientId, name: "Agreed" }, db);

    await transitionProject(project.id, "active", {}, db);

    const counts = await countProjectsByStatus(db);
    expect(counts.draft).toBe(0);
    expect(counts.active).toBe(1);
  });

  it("stops counting a project that was deleted", async () => {
    const project = await createProject(
      { clientId, name: "Mistake", status: "paused" },
      db,
    );

    await deleteProject(project.id, db);

    expect((await countProjectsByStatus(db)).paused).toBe(0);
  });
});

describe("a project row with a status outside the enum", () => {
  /**
   * The column is plain TEXT, so this is reachable by hand-editing the database
   * or by a migration that adds a status the code does not know yet. Written
   * with raw SQL because the typed API cannot express it — which is the point.
   */
  async function corruptTheStatus(id: string): Promise<void> {
    await db.run(sql`update projects set status = 'mothballed' where id = ${id}`);
  }

  it("is counted nowhere rather than throwing", async () => {
    const project = await createProject({ clientId, name: "Odd one" }, db);
    await corruptTheStatus(project.id);

    expect(await countProjectsByStatus(db)).toEqual({
      draft: 0,
      active: 0,
      paused: 0,
      closed: 0,
    });
  });

  it("leaves the other statuses counted correctly", async () => {
    const odd = await createProject({ clientId, name: "Odd one" }, db);
    await createProject({ clientId, name: "Normal", status: "active" }, db);
    await corruptTheStatus(odd.id);

    expect((await countProjectsByStatus(db)).active).toBe(1);
  });

  it("still shows up on the unfiltered list, so nothing is hidden", async () => {
    const project = await createProject({ clientId, name: "Odd one" }, db);
    await corruptTheStatus(project.id);

    const rows = await listProjectsWithClient({}, db);

    expect(rows.map((row) => row.name)).toEqual(["Odd one"]);
  });
});

/**
 * A project parked in `status`, for a transition test to move out of. Built by
 * creating it there rather than by walking it through the lifecycle, so that a
 * test of one move is not also a test of the moves before it.
 *
 * Nothing waits here: the trail is ordered by insertion, so the opening event
 * and the move after it keep their order however close together they land.
 */
async function projectIn(status: ProjectStatus) {
  return createProject({ clientId, name: `A ${status} one`, status }, db);
}

describe("transitionProject on a legal move", () => {
  it("starts a draft", async () => {
    const project = await projectIn("draft");

    const result = await transitionProject(project.id, "active", {}, db);

    expect(result.ok).toBe(true);
    expect((await getProject(project.id, db))?.status).toBe("active");
  });

  it("cancels a draft that never ran", async () => {
    const project = await projectIn("draft");

    const result = await transitionProject(project.id, "closed", {}, db);

    expect(result.ok).toBe(true);
    expect((await getProject(project.id, db))?.status).toBe("closed");
  });

  it("pauses running work", async () => {
    const project = await projectIn("active");

    expect((await transitionProject(project.id, "paused", {}, db)).ok).toBe(
      true,
    );
  });

  it("closes running work", async () => {
    const project = await projectIn("active");

    expect((await transitionProject(project.id, "closed", {}, db)).ok).toBe(
      true,
    );
  });

  it("resumes paused work", async () => {
    const project = await projectIn("paused");

    expect((await transitionProject(project.id, "active", {}, db)).ok).toBe(
      true,
    );
  });

  it("closes paused work", async () => {
    const project = await projectIn("paused");

    expect((await transitionProject(project.id, "closed", {}, db)).ok).toBe(
      true,
    );
  });

  it("reopens a closed project that says why", async () => {
    const project = await projectIn("closed");

    const result = await transitionProject(
      project.id,
      "active",
      { reason: "They came back for phase two." },
      db,
    );

    expect(result.ok).toBe(true);
    expect((await getProject(project.id, db))?.status).toBe("active");
  });

  it("hands back the saved row rather than the one it read", async () => {
    const project = await projectIn("draft");
    // `updatedAt` comes from the wall clock, so the write has to land in a
    // different millisecond from the create for the comparison to mean
    // anything.
    await tick();

    const result = await transitionProject(project.id, "active", {}, db);

    expect(result.ok && result.project.status).toBe("active");
    expect(result.ok && result.project.updatedAt).not.toBe(project.updatedAt);
  });
});

describe("transitionProject on an illegal move", () => {
  it("refuses to put running work back to draft", async () => {
    const project = await projectIn("active");

    const result = await transitionProject(project.id, "draft", {}, db);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem.code).toBe("illegal");
  });

  it("refuses to pause a draft that has not started", async () => {
    const project = await projectIn("draft");

    const result = await transitionProject(project.id, "paused", {}, db);

    expect(!result.ok && result.problem.code).toBe("illegal");
  });

  it("refuses to pause a closed project", async () => {
    const project = await projectIn("closed");

    const result = await transitionProject(project.id, "paused", {}, db);

    expect(!result.ok && result.problem.code).toBe("illegal");
  });

  it("refuses to move a project to the status it is already in", async () => {
    const project = await projectIn("active");

    const result = await transitionProject(project.id, "active", {}, db);

    expect(!result.ok && result.problem.message).toMatch(/already active/);
  });

  it("leaves the row exactly as it was", async () => {
    const project = await projectIn("closed");

    await transitionProject(project.id, "draft", {}, db);

    expect(await getProject(project.id, db)).toEqual(project);
  });

  it("writes no line of history for a move that did not happen", async () => {
    const project = await projectIn("closed");

    await transitionProject(project.id, "paused", {}, db);

    expect(await listProjectStatusEvents(project.id, db)).toHaveLength(1);
  });

  it("refuses a status outside the four before it reads anything", async () => {
    const project = await projectIn("draft");

    await expect(
      transitionProject(project.id, "archived" as ProjectStatus, {}, db),
    ).rejects.toThrow(/unknown project status/);
    expect(await getProject(project.id, db)).toEqual(project);
  });

  it("refuses every move out of a status outside the four", async () => {
    const project = await projectIn("draft");
    await db.run(
      sql`update projects set status = 'mothballed' where id = ${project.id}`,
    );

    const result = await transitionProject(project.id, "active", {}, db);

    expect(!result.ok && result.problem.code).toBe("illegal");
    expect(!result.ok && result.problem.message).toMatch(/"mothballed"/);
  });
});

describe("transitionProject and the reason", () => {
  it("refuses to reopen a closed project in silence", async () => {
    const project = await projectIn("closed");

    const result = await transitionProject(project.id, "active", {}, db);

    expect(!result.ok && result.problem.code).toBe("reason-required");
    expect((await getProject(project.id, db))?.status).toBe("closed");
  });

  it("treats a reason of only whitespace as no reason at all", async () => {
    const project = await projectIn("closed");

    const result = await transitionProject(
      project.id,
      "active",
      { reason: "   \n  " },
      db,
    );

    expect(!result.ok && result.problem.code).toBe("reason-required");
  });

  it("refuses a reason longer than the column should hold", async () => {
    const project = await projectIn("closed");

    const result = await transitionProject(
      project.id,
      "active",
      { reason: "x".repeat(TRANSITION_REASON_LIMIT + 1) },
      db,
    );

    expect(!result.ok && result.problem.code).toBe("reason-too-long");
  });

  it("keeps the reason on the trail, trimmed", async () => {
    const project = await projectIn("closed");

    await transitionProject(
      project.id,
      "active",
      { reason: "  They came back for phase two.  " },
      db,
    );

    const [latest] = await listProjectStatusEvents(project.id, db);
    expect(latest.reason).toBe("They came back for phase two.");
  });

  it("keeps a note on a move that did not need one", async () => {
    const project = await projectIn("active");

    await transitionProject(
      project.id,
      "paused",
      { reason: "Waiting on their copy." },
      db,
    );

    const [latest] = await listProjectStatusEvents(project.id, db);
    expect(latest.reason).toBe("Waiting on their copy.");
  });

  it("records no reason when none was given", async () => {
    const project = await projectIn("draft");

    await transitionProject(project.id, "active", {}, db);

    const [latest] = await listProjectStatusEvents(project.id, db);
    expect(latest.reason).toBeNull();
  });
});

describe("transitionProject and the lifecycle dates", () => {
  it("dates the start when a draft is started", async () => {
    const project = await projectIn("draft");

    const result = await transitionProject(project.id, "active", {}, db);

    expect(result.ok && result.project.startedAt).not.toBeNull();
  });

  it("keeps the original start across a pause and a resume", async () => {
    const project = await projectIn("active");

    await transitionProject(project.id, "paused", {}, db);
    const resumed = await transitionProject(project.id, "active", {}, db);

    expect(resumed.ok && resumed.project.startedAt).toBe(project.startedAt);
  });

  it("dates the close when the work is finished", async () => {
    const project = await projectIn("active");

    const closed = await transitionProject(project.id, "closed", {}, db);

    expect(closed.ok && closed.project.closedAt).not.toBeNull();
    expect(closed.ok && closed.project.startedAt).toBe(project.startedAt);
  });

  it("clears the close date when a closed project reopens", async () => {
    const project = await projectIn("active");
    await transitionProject(project.id, "closed", {}, db);

    const reopened = await transitionProject(
      project.id,
      "active",
      { reason: "Phase two." },
      db,
    );

    expect(reopened.ok && reopened.project.closedAt).toBeNull();
    expect(reopened.ok && reopened.project.startedAt).toBe(project.startedAt);
  });

  it("starts a cancelled draft's clock at nothing, and ends it", async () => {
    const project = await projectIn("draft");

    const cancelled = await transitionProject(project.id, "closed", {}, db);

    expect(cancelled.ok && cancelled.project.startedAt).toBeNull();
    expect(cancelled.ok && cancelled.project.closedAt).not.toBeNull();
  });
});

describe("transitionProject and the trail", () => {
  it("records both ends of the move", async () => {
    const project = await projectIn("active");

    await transitionProject(project.id, "paused", {}, db);

    const [latest] = await listProjectStatusEvents(project.id, db);
    expect(latest.fromStatus).toBe("active");
    expect(latest.toStatus).toBe("paused");
  });

  it("appends rather than replacing, so the whole story is there", async () => {
    const project = await projectIn("draft");
    await transitionProject(project.id, "active", {}, db);
    await transitionProject(project.id, "paused", {}, db);
    await transitionProject(project.id, "closed", {}, db);

    const events = await listProjectStatusEvents(project.id, db);

    expect(events.map((event) => event.toStatus)).toEqual([
      "closed",
      "paused",
      "active",
      "draft",
    ]);
  });

  it("writes one line per move, not one per press", async () => {
    const project = await projectIn("active");

    await transitionProject(project.id, "closed", {}, db);
    await transitionProject(project.id, "closed", {}, db);

    expect(await listProjectStatusEvents(project.id, db)).toHaveLength(2);
  });

  it("keeps the trail of a reopening and the close before it", async () => {
    const project = await projectIn("closed");

    await transitionProject(
      project.id,
      "active",
      { reason: "Phase two." },
      db,
    );

    const events = await listProjectStatusEvents(project.id, db);
    expect(events).toHaveLength(2);
    expect(events[0].reason).toBe("Phase two.");
    expect(events[1].fromStatus).toBeNull();
  });
});

describe("transitionProject on a project that is not there", () => {
  it("says so rather than throwing", async () => {
    const result = await transitionProject("prj_nope", "active", {}, db);

    expect(!result.ok && result.problem.code).toBe("no-such-project");
  });

  it("says so even when the move would have been illegal anyway", async () => {
    const result = await transitionProject("prj_nope", "draft", {}, db);

    expect(!result.ok && result.problem.code).toBe("no-such-project");
  });
});

/**
 * A project worth copying, with its scope agreed and some of it done, so
 * every test below can say what crossed over and what did not.
 */
async function source(): Promise<string> {
  const project = await createProject(
    {
      clientId,
      name: "Harbour Co — site rebuild",
      status: "active",
      contractValueCents: 1_200_000,
      rateCents: 9_500,
    },
    db,
  );
  await createDeliverable(
    {
      projectId: project.id,
      title: "Discovery",
      description: "Two workshops.",
      estimatedMinutes: 480,
      status: "done",
    },
    db,
  );
  await createDeliverable(
    {
      projectId: project.id,
      title: "Build",
      estimatedMinutes: 2_400,
      status: "started",
    },
    db,
  );
  await createDeliverable(
    { projectId: project.id, title: "Handover", estimatedMinutes: 0 },
    db,
  );
  return project.id;
}

describe("duplicateProject", () => {
  it("writes a second project rather than touching the first", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok).toBe(true);
    expect(result.ok && result.project.id).not.toBe(id);
    expect(result.ok && result.project.id).toMatch(/^prj_/);
    expect(await listProjects(db)).toHaveLength(2);
  });

  it("calls the copy what it was asked to call it", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok && result.project.name).toBe("Phase two");
  });

  it("leaves the source project exactly as it was", async () => {
    const id = await source();
    const before = await getProject(id, db);

    await duplicateProject(id, { name: "Phase two" }, db);

    expect(await getProject(id, db)).toEqual(before);
  });
});

describe("duplicateProject and the agreement", () => {
  it("files the copy under the same client", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok && result.project.clientId).toBe(clientId);
  });

  it("carries the contract value across", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok && result.project.contractValueCents).toBe(1_200_000);
  });

  it("carries the rate override across", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok && result.project.rateCents).toBe(9_500);
  });

  it("leaves an inherited rate inherited rather than writing a zero", async () => {
    const project = await createProject(
      { clientId, name: "Retainer", rateCents: null },
      db,
    );

    const result = await duplicateProject(project.id, { name: "Copy" }, db);

    expect(result.ok && result.project.rateCents).toBeNull();
  });

  it("carries an override of zero, which is not the same as none", async () => {
    const project = await createProject(
      { clientId, name: "Fixed fee", rateCents: 0 },
      db,
    );

    const result = await duplicateProject(project.id, { name: "Copy" }, db);

    expect(result.ok && result.project.rateCents).toBe(0);
  });

  it("copies a project nobody has agreed a value for as a zero", async () => {
    const project = await createProject({ clientId, name: "Scoping" }, db);

    const result = await duplicateProject(project.id, { name: "Copy" }, db);

    expect(result.ok && result.project.contractValueCents).toBe(0);
  });
});

describe("duplicateProject and the scope list", () => {
  it("copies every line, in the order the source reads", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const copy = result.ok ? await listDeliverables(result.project.id, db) : [];

    expect(copy.map((line) => line.title)).toEqual([
      "Discovery",
      "Build",
      "Handover",
    ]);
  });

  it("carries the detail and the estimate on each line", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const copy = result.ok ? await listDeliverables(result.project.id, db) : [];

    expect(copy.map((line) => line.description)).toEqual([
      "Two workshops.",
      null,
      null,
    ]);
    expect(copy.map((line) => line.estimatedMinutes)).toEqual([480, 2_400, 0]);
  });

  it("numbers the copied list densely from zero", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const copy = result.ok ? await listDeliverables(result.project.id, db) : [];

    expect(copy.map((line) => line.sortOrder)).toEqual([0, 1, 2]);
  });

  it("writes new rows rather than moving the source's", async () => {
    const id = await source();
    const before = await listDeliverables(id, db);

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const copy = result.ok ? await listDeliverables(result.project.id, db) : [];

    expect(await listDeliverables(id, db)).toEqual(before);
    for (const line of copy) {
      expect(line.id).toMatch(/^dlv_/);
      expect(before.map((row) => row.id)).not.toContain(line.id);
      expect(line.projectId).toBe(result.ok && result.project.id);
    }
  });

  it("hands back the copied lines in the order they now read", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok && result.deliverables.map((line) => line.title)).toEqual([
      "Discovery",
      "Build",
      "Handover",
    ]);
  });
});

describe("duplicateProject and the work already done", () => {
  it("opens every copied line as pending, whatever the source says", async () => {
    const id = await source();
    expect((await listDeliverables(id, db)).map((line) => line.status)).toEqual(
      ["done", "started", "pending"],
    );

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const copy = result.ok ? await listDeliverables(result.project.id, db) : [];

    expect(copy.map((line) => line.status)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("leaves the source's own statuses alone", async () => {
    const id = await source();

    await duplicateProject(id, { name: "Phase two" }, db);

    expect((await listDeliverables(id, db)).map((line) => line.status)).toEqual(
      ["done", "started", "pending"],
    );
  });
});

describe("duplicateProject and the lifecycle", () => {
  it("opens the copy as a draft, however far the source has got", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);

    expect(result.ok && result.project.status).toBe("draft");
  });

  it("opens a copy of a closed project as a draft too", async () => {
    const project = await createProject(
      { clientId, name: "Last year's rebuild", status: "closed" },
      db,
    );

    const result = await duplicateProject(project.id, { name: "Copy" }, db);

    expect(result.ok && result.project.status).toBe("draft");
  });

  it("gives the copy no start or close date of its own", async () => {
    // Through the lifecycle rather than created closed, so the source has
    // both stamps on it: a project that ran and then finished.
    const project = await createProject(
      { clientId, name: "Last year's rebuild", status: "active" },
      db,
    );
    await transitionProject(project.id, "closed", {}, db);
    const closed = await getProject(project.id, db);
    expect(closed?.startedAt).not.toBeNull();
    expect(closed?.closedAt).not.toBeNull();

    const result = await duplicateProject(project.id, { name: "Copy" }, db);

    expect(result.ok && result.project.startedAt).toBeNull();
    expect(result.ok && result.project.closedAt).toBeNull();
  });

  it("starts the copy's status trail at its own creation", async () => {
    const id = await source();

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const trail = result.ok
      ? await listProjectStatusEvents(result.project.id, db)
      : [];

    expect(trail).toHaveLength(1);
    expect(trail[0].fromStatus).toBeNull();
    expect(trail[0].toStatus).toBe("draft");
  });

  it("copies none of the source's history onto the copy", async () => {
    const id = await source();
    await transitionProject(id, "paused", { reason: "Waiting on copy." }, db);
    expect(await listProjectStatusEvents(id, db)).toHaveLength(2);

    const result = await duplicateProject(id, { name: "Phase two" }, db);
    const trail = result.ok
      ? await listProjectStatusEvents(result.project.id, db)
      : [];

    expect(trail).toHaveLength(1);
    expect(trail.map((event) => event.reason)).toEqual([null]);
  });

  it("leaves the source's trail untouched", async () => {
    const id = await source();
    const before = await listProjectStatusEvents(id, db);

    await duplicateProject(id, { name: "Phase two" }, db);

    expect(await listProjectStatusEvents(id, db)).toEqual(before);
  });
});

describe("duplicateProject on a project that is not there", () => {
  it("says so rather than throwing", async () => {
    const result = await duplicateProject("prj_nope", { name: "Copy" }, db);

    expect(result).toEqual({ ok: false, reason: "no-such-project" });
  });

  it("writes nothing when there was nothing to copy", async () => {
    await duplicateProject("prj_nope", { name: "Copy" }, db);

    expect(await listProjects(db)).toEqual([]);
  });
});
