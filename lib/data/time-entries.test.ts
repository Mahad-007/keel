import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createProject } from "./projects";
import { createTimeEntry } from "./time-entries";

let db: Database;
/** Every time entry hangs off a project, which hangs off a client. */
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Harbour Co" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Site rebuild" },
    db,
  );
  projectId = project.id;
});

describe("createTimeEntry", () => {
  it("stores the entry and hands back the saved row", async () => {
    const entry = await createTimeEntry(
      {
        projectId,
        minutes: 90,
        note: "Kickoff call",
        workedOn: "2026-10-16",
      },
      db,
    );

    expect(entry.id).toMatch(/^tme_/);
    expect(entry.projectId).toBe(projectId);
    expect(entry.minutes).toBe(90);
    expect(entry.note).toBe("Kickoff call");
    expect(entry.workedOn).toBe("2026-10-16");
  });

  it("stamps both timestamps as a full ISO moment", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 30, workedOn: "2026-10-16" },
      db,
    );

    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.updatedAt).toBe(entry.createdAt);
  });
});
