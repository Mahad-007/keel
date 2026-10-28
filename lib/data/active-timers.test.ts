import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createProject } from "./projects";
import { getActiveTimer } from "./active-timers";

let db: Database;
/** Every timer hangs off a project, which hangs off a client. */
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Harbour Co" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Site rebuild", contractValueCents: 500_000 },
    db,
  );
  projectId = project.id;
});

describe("getActiveTimer", () => {
  it("is null when no clock is running", async () => {
    expect(await getActiveTimer(db)).toBeNull();
  });
});
