import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { getActiveTimer, startActiveTimer } from "./active-timers";
import { createClient } from "./clients";
import { createDeliverable } from "./deliverables";
import { createProject } from "./projects";

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

/** The day the reader's own clock says it is, as the browser would send it. */
const TODAY = "2026-10-28";

describe("startActiveTimer", () => {
  it("writes a running timer against the project", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.timer).toMatchObject({
      projectId,
      startedOn: TODAY,
      deliverableId: null,
      note: null,
    });
  });

  it("is found by the read afterwards, which is the point of the row", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the first timer should have started");

    expect(await getActiveTimer(db)).toMatchObject({ id: started.timer.id });
  });

  it("stamps the instant it started, not just the day", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    expect(Number.isNaN(Date.parse(started.timer.startedAt))).toBe(false);
  });

  it("treats time against a client engagement as chargeable", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    expect(started.timer.billable).toBe(true);
  });

  it("records a clock started as not chargeable", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, billable: false },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    expect(started.timer.billable).toBe(false);
  });

  it("keeps the note and the line of scope it was started against", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Importer", estimatedMinutes: 240 },
      db,
    );
    const started = await startActiveTimer(
      {
        projectId,
        startedOn: TODAY,
        deliverableId: deliverable.id,
        note: "  Pairing on the importer  ",
      },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    expect(started.timer).toMatchObject({
      deliverableId: deliverable.id,
      note: "Pairing on the importer",
    });
  });

  it("stores a blank note as no note rather than as an empty one", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, note: "   " },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    expect(started.timer.note).toBeNull();
  });

  it("reads a blank attribution as work on the project itself", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, deliverableId: "" },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    expect(started.timer.deliverableId).toBeNull();
  });
});

/**
 * The one refusal a reader can act on, and the reason the table has a unique
 * index rather than a convention.
 */
describe("startActiveTimer against a clock already running", () => {
  it("refuses the second press", async () => {
    await startActiveTimer({ projectId, startedOn: TODAY }, db);
    const second = await startActiveTimer({ projectId, startedOn: TODAY }, db);

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.refusal).toBe("already-running");
  });

  it("hands back the clock that was already going", async () => {
    const first = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!first.ok) throw new Error("the first timer should have started");

    const second = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (second.ok) throw new Error("the second timer should have been refused");

    expect(second.running).toMatchObject({ id: first.timer.id });
  });

  it("refuses a clock on another project, not only on this one", async () => {
    const other = await createProject(
      {
        clientId: (await createClient({ name: "Second Co" }, db)).id,
        name: "Brand refresh",
      },
      db,
    );
    const first = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!first.ok) throw new Error("the first timer should have started");

    const second = await startActiveTimer(
      { projectId: other.id, startedOn: TODAY },
      db,
    );
    if (second.ok) throw new Error("the second timer should have been refused");

    expect(second.running.projectId).toBe(projectId);
  });

  it("leaves the running clock untouched", async () => {
    const first = await startActiveTimer(
      { projectId, startedOn: TODAY, note: "Discovery call" },
      db,
    );
    if (!first.ok) throw new Error("the first timer should have started");

    await startActiveTimer({ projectId, startedOn: TODAY, note: "Build" }, db);

    expect(await getActiveTimer(db)).toMatchObject({
      id: first.timer.id,
      note: "Discovery call",
      startedAt: first.timer.startedAt,
    });
  });
});
