import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { listProjectStatusEvents } from "@/lib/data/project-status-events";
import { createProject, transitionProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import type { ProjectStatus } from "./status";
import {
  EMPTY_TRANSITION_FIELDS,
  parseTransitionForm,
  type TransitionFormFields,
} from "./transition-form";

/**
 * The seam between the status form and the data layer. Both run the same
 * guard — the form to put a message beside a field, `transitionProject` to
 * protect the row — and the two could drift: a move the form accepts and the
 * transaction refuses is a submission that looks saved and is not.
 *
 * These tests push what the form produces at a real database and read back
 * both the row and its trail, so the drift fails here rather than in front of
 * somebody closing a project.
 */

let db: Database;
let clientId: string;

beforeEach(async () => {
  db = await createTestDb();
  clientId = (await createClient({ name: "Ada Lovelace" }, db)).id;
});

/** Submits a move the way the form does, and writes it if the form allows. */
async function press(
  projectId: string,
  from: ProjectStatus,
  fields: Partial<TransitionFormFields>,
) {
  const parsed = parseTransitionForm(
    { ...EMPTY_TRANSITION_FIELDS, ...fields },
    from,
  );
  if (!parsed.ok) return { parsed, written: null };
  const written = await transitionProject(
    projectId,
    parsed.value.status,
    { reason: parsed.value.reason },
    db,
  );
  return { parsed, written };
}

describe("a project walked through its whole lifecycle", () => {
  it("records every move it made, in order", async () => {
    const project = await createProject({ clientId, name: "Rebuild" }, db);

    const started = await press(project.id, "draft", { status: "active" });
    const paused = await press(project.id, "active", { status: "paused" });
    const resumed = await press(project.id, "paused", { status: "active" });
    const closed = await press(project.id, "active", { status: "closed" });
    const reopened = await press(project.id, "closed", {
      status: "active",
      reason: "They came back for phase two.",
    });

    for (const step of [started, paused, resumed, closed, reopened]) {
      expect(step.written?.ok).toBe(true);
    }

    const trail = await listProjectStatusEvents(project.id, db);
    expect(trail).toHaveLength(6);
    expect(trail.at(-1)?.fromStatus).toBeNull();
    expect(trail[0].reason).toBe("They came back for phase two.");
  });
});

describe("the form and the data layer on an illegal move", () => {
  it("stops a reopening with no reason at the form, before any write", async () => {
    const project = await createProject(
      { clientId, name: "Finished", status: "closed" },
      db,
    );

    const { parsed, written } = await press(project.id, "closed", {
      status: "active",
    });

    expect(parsed.ok).toBe(false);
    expect(written).toBeNull();
    expect(await listProjectStatusEvents(project.id, db)).toHaveLength(1);
  });

  it("stops a move back to draft at the form", async () => {
    const project = await createProject(
      { clientId, name: "Running", status: "active" },
      db,
    );

    const { parsed } = await press(project.id, "active", { status: "draft" });

    expect(parsed.ok).toBe(false);
  });

  it("stops the same move at the transaction when the form was told a stale status", async () => {
    const project = await createProject(
      { clientId, name: "Running", status: "active" },
      db,
    );
    await transitionProject(project.id, "closed", {}, db);

    // The page still believes the project is active, so the form accepts a
    // pause. The transaction reads the row as it is and refuses.
    const { parsed, written } = await press(project.id, "active", {
      status: "paused",
    });

    expect(parsed.ok).toBe(true);
    expect(written?.ok).toBe(false);
    expect(written?.ok === false && written.problem.code).toBe("illegal");
  });

  it("leaves the status where it was when the transaction refuses", async () => {
    const project = await createProject(
      { clientId, name: "Running", status: "active" },
      db,
    );
    await transitionProject(project.id, "closed", {}, db);

    await press(project.id, "active", { status: "paused" });

    const trail = await listProjectStatusEvents(project.id, db);
    expect(trail[0].toStatus).toBe("closed");
    expect(trail).toHaveLength(2);
  });
});
