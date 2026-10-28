import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { MAX_ENTRY_MINUTES } from "@/lib/time/form";

import {
  discardActiveTimer,
  getActiveTimer,
  getRunningTimer,
  startActiveTimer,
  stopActiveTimer,
} from "./active-timers";
import { createClient } from "./clients";
import { createDeliverable, deleteDeliverable } from "./deliverables";
import { createProject, deleteProject } from "./projects";
import { listTimeEntries } from "./time-entries";

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

/**
 * A clock reading a given number of minutes after the timer started.
 *
 * `stopActiveTimer` takes `now` rather than reading the wall clock, so a
 * stretch of any length can be stopped without waiting for it — which is the
 * reason the parameter is there.
 */
function minutesLater(startedAt: string, minutes: number): Date {
  return new Date(Date.parse(startedAt) + minutes * 60_000);
}

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

/**
 * The two calls no page this app renders can make, which is why they throw
 * rather than coming back as refusals.
 */
describe("startActiveTimer on a project it cannot have", () => {
  it("refuses a project that does not exist, naming the id", async () => {
    await expect(
      startActiveTimer({ projectId: "prj_missing", startedOn: TODAY }, db),
    ).rejects.toThrow("no project with id prj_missing");
  });

  it("refuses a blank project", async () => {
    await expect(
      startActiveTimer({ projectId: "  ", startedOn: TODAY }, db),
    ).rejects.toThrow("timer project is required");
  });

  it("refuses a deliverable that does not exist", async () => {
    await expect(
      startActiveTimer(
        { projectId, startedOn: TODAY, deliverableId: "dlv_missing" },
        db,
      ),
    ).rejects.toThrow("no deliverable with id dlv_missing");
  });

  it("refuses another project's line of scope", async () => {
    const client = await createClient({ name: "Second Co" }, db);
    const other = await createProject(
      { clientId: client.id, name: "Brand refresh" },
      db,
    );
    const theirs = await createDeliverable(
      { projectId: other.id, title: "Logo" },
      db,
    );

    await expect(
      startActiveTimer(
        { projectId, startedOn: TODAY, deliverableId: theirs.id },
        db,
      ),
    ).rejects.toThrow(`does not belong to project ${projectId}`);
  });

  it("refuses a day with a time of day on it", async () => {
    await expect(
      startActiveTimer(
        { projectId, startedOn: "2026-10-28T09:00:00.000Z" },
        db,
      ),
    ).rejects.toThrow("timer started on must be a calendar date");
  });

  it("writes nothing when it refuses", async () => {
    await expect(
      startActiveTimer({ projectId: "prj_missing", startedOn: TODAY }, db),
    ).rejects.toThrow();

    expect(await getActiveTimer(db)).toBeNull();
  });
});

describe("discardActiveTimer", () => {
  it("removes the clock and hands back the row it removed", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    const discarded = await discardActiveTimer(started.timer.id, db);

    expect(discarded).toMatchObject({ id: started.timer.id });
    expect(await getActiveTimer(db)).toBeNull();
  });

  it("writes no time entry, because a discarded clock is not work", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await discardActiveTimer(started.timer.id, db);

    expect(await listTimeEntries(projectId, db)).toEqual([]);
  });

  it("frees the slot, so a clock can be started again", async () => {
    const first = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!first.ok) throw new Error("the first timer should have started");
    await discardActiveTimer(first.timer.id, db);

    const second = await startActiveTimer({ projectId, startedOn: TODAY }, db);

    expect(second.ok).toBe(true);
  });

  it("is null for an id that is not the running clock", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    expect(await discardActiveTimer("tmr_stale", db)).toBeNull();
  });

  it("leaves the running clock alone when the id does not match", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await discardActiveTimer("tmr_stale", db);

    expect(await getActiveTimer(db)).toMatchObject({ id: started.timer.id });
  });

  it("is null when nothing is running at all", async () => {
    expect(await discardActiveTimer("tmr_gone", db)).toBeNull();
  });
});

describe("stopActiveTimer", () => {
  it("writes the elapsed minutes as a time entry", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 25),
      db,
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.entry).toMatchObject({
      projectId,
      minutes: 25,
      workedOn: TODAY,
    });
    expect(stopped.minutes).toBe(25);
  });

  it("leaves the entry where every other figure reads it from", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 45),
      db,
    );

    const entries = await listTimeEntries(projectId, db);
    expect(entries).toHaveLength(1);
    expect(entries[0].minutes).toBe(45);
  });

  it("removes the clock, so the slot is free again", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 5),
      db,
    );

    expect(await getActiveTimer(db)).toBeNull();
    expect(
      (await startActiveTimer({ projectId, startedOn: TODAY }, db)).ok,
    ).toBe(true);
  });

  it("hands back the timer it stopped, for the sentence afterwards", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Importer", estimatedMinutes: 240 },
      db,
    );
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, deliverableId: deliverable.id },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 30),
      db,
    );
    if (!stopped.ok) throw new Error("the timer should have stopped");

    expect(stopped.stopped).toMatchObject({ id: started.timer.id });
    expect(stopped.entry.deliverableId).toBe(deliverable.id);
  });

  it("carries a non-chargeable clock through to a non-chargeable entry", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, billable: false, note: "Our own bug" },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 15),
      db,
    );
    if (!stopped.ok) throw new Error("the timer should have stopped");

    expect(stopped.entry).toMatchObject({
      billable: false,
      note: "Our own bug",
    });
  });

  it("files the entry under the day the clock started, not the day it ended", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: "2026-10-27" },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 30),
      db,
    );
    if (!stopped.ok) throw new Error("the timer should have stopped");

    expect(stopped.entry.workedOn).toBe("2026-10-27");
  });
});

/**
 * The refusals, which all leave the clock running. A reader who pressed Stop
 * has not asked to throw the work away — that is what discarding is for.
 */
describe("stopActiveTimer when it will not stop", () => {
  it("refuses a clock that has not reached a minute", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 0),
      db,
    );

    expect(stopped.ok).toBe(false);
    if (stopped.ok) return;
    expect(stopped.refusal).toBe("too-short");
  });

  it("writes nothing and keeps the clock running when it is too short", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await stopActiveTimer(
      started.timer.id,
      new Date(started.timer.startedAt),
      db,
    );

    expect(await listTimeEntries(projectId, db)).toEqual([]);
    expect(await getActiveTimer(db)).toMatchObject({ id: started.timer.id });
  });

  it("refuses a clock left running past a day, with the figure", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, MAX_ENTRY_MINUTES + 60),
      db,
    );

    expect(stopped.ok).toBe(false);
    if (stopped.ok) return;
    expect(stopped.refusal).toBe("too-long");
    if (stopped.refusal === "no-such-timer") return;
    expect(stopped.minutes).toBe(MAX_ENTRY_MINUTES + 60);
  });

  it("writes nothing and keeps the clock running when it is too long", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 3 * MAX_ENTRY_MINUTES),
      db,
    );

    expect(await listTimeEntries(projectId, db)).toEqual([]);
    expect(await getActiveTimer(db)).toMatchObject({ id: started.timer.id });
  });

  it("stops a clock that has run for exactly a day", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, MAX_ENTRY_MINUTES),
      db,
    );

    expect(stopped.ok).toBe(true);
  });

  it("refuses an id that is not the running clock", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    const stopped = await stopActiveTimer(
      "tmr_stale",
      minutesLater(started.timer.startedAt, 30),
      db,
    );

    expect(stopped.ok).toBe(false);
    if (stopped.ok) return;
    expect(stopped.refusal).toBe("no-such-timer");
    expect(await getActiveTimer(db)).toMatchObject({ id: started.timer.id });
  });

  it("refuses when nothing is running at all", async () => {
    const stopped = await stopActiveTimer("tmr_gone", new Date(), db);

    expect(stopped.ok).toBe(false);
    if (stopped.ok) return;
    expect(stopped.refusal).toBe("no-such-timer");
  });

  it("cannot be stopped twice into two entries", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");
    const at = minutesLater(started.timer.startedAt, 20);

    await stopActiveTimer(started.timer.id, at, db);
    const again = await stopActiveTimer(started.timer.id, at, db);

    expect(again.ok).toBe(false);
    expect(await listTimeEntries(projectId, db)).toHaveLength(1);
  });
});

/**
 * What happens to a running clock when the thing it is running against goes.
 * Both are the schema's doing rather than this module's, which is why they are
 * worth a test: a cascade nobody asserts is a cascade that can be dropped by
 * the next migration without anything noticing.
 */
describe("a running timer whose project or line of scope is deleted", () => {
  it("goes with the project, because there is nothing left to bill", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    await deleteProject(projectId, db);

    expect(await getActiveTimer(db)).toBeNull();
  });

  it("keeps running when its deliverable is deleted, now unattributed", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Importer", estimatedMinutes: 240 },
      db,
    );
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, deliverableId: deliverable.id },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    await deleteDeliverable(deliverable.id, db);

    expect(await getActiveTimer(db)).toMatchObject({
      id: started.timer.id,
      deliverableId: null,
    });
  });

  it("still stops into an entry after its line of scope is dropped", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Importer", estimatedMinutes: 240 },
      db,
    );
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, deliverableId: deliverable.id },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");
    await deleteDeliverable(deliverable.id, db);

    const stopped = await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 20),
      db,
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.entry).toMatchObject({ minutes: 20, deliverableId: null });
  });
});

describe("getRunningTimer", () => {
  it("is null when no clock is running", async () => {
    expect(await getRunningTimer(db)).toBeNull();
  });

  it("names the project the clock is on", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");

    expect(await getRunningTimer(db)).toMatchObject({
      id: started.timer.id,
      projectName: "Site rebuild",
    });
  });

  it("carries every column the timer row has", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: TODAY, note: "Discovery call", billable: false },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    expect(await getRunningTimer(db)).toMatchObject({
      note: "Discovery call",
      billable: false,
      startedOn: TODAY,
      startedAt: started.timer.startedAt,
    });
  });

  it("is null again once the clock is stopped", async () => {
    const started = await startActiveTimer({ projectId, startedOn: TODAY }, db);
    if (!started.ok) throw new Error("the timer should have started");
    await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 10),
      db,
    );

    expect(await getRunningTimer(db)).toBeNull();
  });
});
