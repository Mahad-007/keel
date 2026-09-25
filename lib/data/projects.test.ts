import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import type { ProjectStatus } from "@/lib/projects/status";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createProject, getProject } from "./projects";

let db: Database;
/** Every project needs a client, so each test starts with one to hang off. */
let clientId: string;

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
