import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createDeliverable } from "./deliverables";
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

  it("stamps both timestamps on a new deliverable", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Launch" },
      db,
    );

    expect(deliverable.createdAt).not.toBe("");
    expect(deliverable.updatedAt).toBe(deliverable.createdAt);
  });
});
