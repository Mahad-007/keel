import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import type { ProjectStatus } from "@/lib/projects/status";
import { createTestDb } from "@/lib/db/testing";

import { archiveClient, createClient } from "./clients";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  listProjectsForClient,
  listProjectsWithClient,
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

describe("updateProject on the status", () => {
  it("dates the start when a draft is activated", async () => {
    const project = await createProject({ clientId, name: "Kickoff" }, db);

    const updated = await updateProject(project.id, { status: "active" }, db);

    expect(updated?.status).toBe("active");
    expect(updated?.startedAt).not.toBeNull();
  });

  it("keeps the original start across a pause and a resume", async () => {
    const project = await createProject(
      { clientId, name: "Stop start", status: "active" },
      db,
    );

    await updateProject(project.id, { status: "paused" }, db);
    const resumed = await updateProject(project.id, { status: "active" }, db);

    expect(resumed?.startedAt).toBe(project.startedAt);
  });

  it("dates the close when the work is finished", async () => {
    const project = await createProject(
      { clientId, name: "Wrapping up", status: "active" },
      db,
    );

    const closed = await updateProject(project.id, { status: "closed" }, db);

    expect(closed?.closedAt).not.toBeNull();
    expect(closed?.startedAt).toBe(project.startedAt);
  });

  it("clears the close date when a closed project reopens", async () => {
    const project = await createProject(
      { clientId, name: "Round two", status: "active" },
      db,
    );
    await updateProject(project.id, { status: "closed" }, db);

    const reopened = await updateProject(project.id, { status: "active" }, db);

    expect(reopened?.closedAt).toBeNull();
    expect(reopened?.startedAt).toBe(project.startedAt);
  });

  it("clears both dates when a project is put back to draft", async () => {
    const project = await createProject(
      { clientId, name: "Never mind", status: "active" },
      db,
    );
    await updateProject(project.id, { status: "closed" }, db);

    const drafted = await updateProject(project.id, { status: "draft" }, db);

    expect(drafted?.startedAt).toBeNull();
    expect(drafted?.closedAt).toBeNull();
  });

  it("keeps the first close date when a closed project is closed again", async () => {
    const project = await createProject(
      { clientId, name: "Twice done", status: "closed" },
      db,
    );
    await tick();

    const again = await updateProject(project.id, { status: "closed" }, db);

    expect(again?.closedAt).toBe(project.closedAt);
  });

  it("refuses a status outside the four and writes nothing", async () => {
    const project = await createProject({ clientId, name: "Valid" }, db);

    await expect(
      updateProject(project.id, { status: "archived" as ProjectStatus }, db),
    ).rejects.toThrow(/unknown project status/);
    expect(await getProject(project.id, db)).toEqual(project);
  });

  it("returns null when the project to re-status does not exist", async () => {
    expect(
      await updateProject("prj_nope", { status: "active" }, db),
    ).toBeNull();
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
