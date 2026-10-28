import { beforeEach, describe, expect, it } from "vitest";

import {
  getRunningTimer,
  startActiveTimer,
  stopActiveTimer,
} from "@/lib/data/active-timers";
import { createClient } from "@/lib/data/clients";
import { createDeliverable, listDeliverables } from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import { listTimeEntries } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { rollUpProject } from "./rollup";
import { elapsedLabel, elapsedMinutes } from "./timer";

/**
 * The seam between a running clock and everything downstream of it.
 *
 * `timer.ts` is pure and its own tests say what the arithmetic does.
 * `active-timers.test.ts` says what the writes do. What neither can say is
 * that a clock started against a line of scope, left running, and stopped
 * arrives in the rollup as time against that line's estimate — which is the
 * whole reason the timer exists rather than being a stopwatch somebody reads
 * off and types in.
 *
 * So the clock is run here over real rows, through the same functions the
 * project page calls, and the figures are taken off the end of it.
 */

let db: Database;
let projectId: string;
let deliverableId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Harbour Co" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Site rebuild", contractValueCents: 400_000 },
    db,
  );
  projectId = project.id;
  const deliverable = await createDeliverable(
    { projectId, title: "Importer", estimatedMinutes: 240 },
    db,
  );
  deliverableId = deliverable.id;
});

/** `stopActiveTimer` takes the clock, so an afternoon costs no waiting. */
function minutesLater(startedAt: string, minutes: number): Date {
  return new Date(Date.parse(startedAt) + minutes * 60_000);
}

describe("a clock started, left running, and stopped", () => {
  it("lands in the rollup against the estimate of the line it ran on", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: "2026-10-28", deliverableId },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 150),
      db,
    );

    const rollup = rollUpProject(
      await listDeliverables(projectId, db),
      await listTimeEntries(projectId, db),
    );
    const line = rollup.lines.find(
      (one) => one.deliverableId === deliverableId,
    );
    expect(line).toMatchObject({
      loggedMinutes: 150,
      estimatedMinutes: 240,
      varianceMinutes: -90,
    });
  });

  it("counts towards the project even when it ran against no line", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: "2026-10-28" },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    await stopActiveTimer(
      started.timer.id,
      minutesLater(started.timer.startedAt, 40),
      db,
    );

    const rollup = rollUpProject(
      await listDeliverables(projectId, db),
      await listTimeEntries(projectId, db),
    );
    expect(rollup.loggedMinutes).toBe(40);
    expect(rollup.unattributed.loggedMinutes).toBe(40);
  });

  it("reads the same figure while running as it writes when stopped", async () => {
    const started = await startActiveTimer(
      { projectId, startedOn: "2026-10-28", deliverableId },
      db,
    );
    if (!started.ok) throw new Error("the timer should have started");

    const running = await getRunningTimer(db);
    if (running === null) throw new Error("the clock should still be running");
    const at = minutesLater(running.startedAt, 95);
    const showing = elapsedMinutes(running.startedAt, at);

    const stopped = await stopActiveTimer(running.id, at, db);
    if (!stopped.ok) throw new Error("the timer should have stopped");

    expect(showing).toBe(95);
    expect(elapsedLabel(showing)).toBe("1h 35m");
    expect(stopped.entry.minutes).toBe(showing);
  });
});
