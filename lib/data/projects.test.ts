import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import type { ProjectStatus } from "@/lib/projects/status";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import {
  createProject,
  getProject,
  listProjects,
  listProjectsForClient,
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
