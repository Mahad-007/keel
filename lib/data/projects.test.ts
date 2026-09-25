import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
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
