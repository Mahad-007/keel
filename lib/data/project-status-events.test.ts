import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import type { ProjectStatus } from "@/lib/projects/status";

import { createClient } from "./clients";
import {
  listProjectStatusEvents,
  recordProjectStatusEvent,
} from "./project-status-events";
import { createProject, deleteProject } from "./projects";

let db: Database;
let projectId: string;

/** Ids and timestamps both order by time, so two rows must not tie. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

beforeEach(async () => {
  db = await createTestDb();
  const clientId = (await createClient({ name: "Anvil Co" }, db)).id;
  projectId = (await createProject({ clientId, name: "Rebuild" }, db)).id;
});

describe("recordProjectStatusEvent", () => {
  it("stores the move and hands back the saved row", async () => {
    const event = await recordProjectStatusEvent(
      { projectId, fromStatus: "draft", toStatus: "active" },
      db,
    );

    expect(event.id).toMatch(/^pse_/);
    expect(event.projectId).toBe(projectId);
    expect(event.fromStatus).toBe("draft");
    expect(event.toStatus).toBe("active");
    expect(event.createdAt).not.toBe("");
  });

  it("keeps the reason it was given", async () => {
    const event = await recordProjectStatusEvent(
      {
        projectId,
        fromStatus: "closed",
        toStatus: "active",
        reason: "They came back for phase two.",
      },
      db,
    );

    expect(event.reason).toBe("They came back for phase two.");
  });

  it("stores a blank reason as absence rather than an empty string", async () => {
    const event = await recordProjectStatusEvent(
      { projectId, fromStatus: "draft", toStatus: "active", reason: "   " },
      db,
    );

    expect(event.reason).toBeNull();
  });

  it("allows a null from-status for a project's opening event", async () => {
    const event = await recordProjectStatusEvent(
      { projectId, fromStatus: null, toStatus: "draft" },
      db,
    );

    expect(event.fromStatus).toBeNull();
  });

  it("refuses a status outside the four the schema allows", async () => {
    await expect(
      recordProjectStatusEvent(
        {
          projectId,
          fromStatus: "draft",
          toStatus: "archived" as ProjectStatus,
        },
        db,
      ),
    ).rejects.toThrow(/unknown project status/);
  });

  it("refuses an event with no project to hang off", async () => {
    await expect(
      recordProjectStatusEvent(
        { projectId: "  ", fromStatus: null, toStatus: "draft" },
        db,
      ),
    ).rejects.toThrow(/required/);
  });
});

describe("listProjectStatusEvents", () => {
  it("returns the trail newest first", async () => {
    await recordProjectStatusEvent(
      { projectId, fromStatus: "draft", toStatus: "active" },
      db,
    );
    await tick();
    await recordProjectStatusEvent(
      { projectId, fromStatus: "active", toStatus: "paused" },
      db,
    );

    const events = await listProjectStatusEvents(projectId, db);

    expect(events.map((event) => event.toStatus)).toEqual([
      "paused",
      "active",
    ]);
  });

  it("returns only the asked-for project's trail", async () => {
    const other = await createProject(
      { clientId: (await createClient({ name: "Other" }, db)).id, name: "Else" },
      db,
    );
    await recordProjectStatusEvent(
      { projectId, fromStatus: "draft", toStatus: "active" },
      db,
    );
    await recordProjectStatusEvent(
      { projectId: other.id, fromStatus: "draft", toStatus: "closed" },
      db,
    );

    const events = await listProjectStatusEvents(projectId, db);

    expect(events.every((event) => event.projectId === projectId)).toBe(true);
  });

  it("returns nothing for a project id that has no trail", async () => {
    expect(await listProjectStatusEvents("prj_nope", db)).toEqual([]);
  });

  it("loses the trail with the project it belonged to", async () => {
    await recordProjectStatusEvent(
      { projectId, fromStatus: "draft", toStatus: "active" },
      db,
    );

    await deleteProject(projectId, db);

    expect(await listProjectStatusEvents(projectId, db)).toEqual([]);
  });
});
