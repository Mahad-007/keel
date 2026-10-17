import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createDeliverable } from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import {
  createTimeEntry,
  listTimeEntries,
  listTimeEntriesForDeliverable,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import {
  BILLABLE_VALUE,
  EMPTY_LOG_TIME_FIELDS,
  LOG_TIME_FIELD_LIMITS,
  MAX_ENTRY_MINUTES,
  parseLogTimeForm,
  type LogTimeFormFields,
} from "./form";

/**
 * The seam between the log-time form and the data layer. Both sides check what
 * they are given — the form to produce a sentence, `createTimeEntry` to protect
 * the columns — and they can drift apart: a duration the form accepts and
 * `positiveMinutes` throws on turns a correctly filled form into a driver
 * error in front of somebody logging their afternoon.
 *
 * These tests write what the form produces to a real database and read it back,
 * so the drift fails here rather than there.
 */

let db: Database;
let projectId: string;
let deliverableId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Booking flow rebuild" },
    db,
  );
  projectId = project.id;
  const deliverable = await createDeliverable(
    { projectId, title: "Wireframes", estimatedMinutes: 360 },
    db,
  );
  deliverableId = deliverable.id;
});

function parsed(fields: Partial<LogTimeFormFields>) {
  const result = parseLogTimeForm(
    {
      ...EMPTY_LOG_TIME_FIELDS,
      duration: "1h30m",
      workedOn: "2026-10-17",
      billable: BILLABLE_VALUE,
      ...fields,
    },
    [deliverableId],
  );
  if (!result.ok) {
    throw new Error(`expected valid fields: ${JSON.stringify(result.errors)}`);
  }
  return result.value;
}

function log(fields: Partial<LogTimeFormFields>) {
  return createTimeEntry({ projectId, ...parsed(fields) }, db);
}

describe("a log-time form the validator accepts", () => {
  it("is written as whole minutes against the day it names", async () => {
    const entry = await log({ note: "Paired on the booking flow" });

    expect(entry.minutes).toBe(90);
    expect(entry.workedOn).toBe("2026-10-17");
    expect(entry.note).toBe("Paired on the booking flow");
    expect(entry.billable).toBe(true);
    expect(entry.billedInvoiceId).toBeNull();
  });

  it("reads back on the project's own list", async () => {
    const entry = await log({});

    const entries = await listTimeEntries(projectId, db);
    expect(entries.map((row) => row.id)).toEqual([entry.id]);
  });

  it("stores an unattributed entry as project-level work", async () => {
    const entry = await log({ deliverable: "" });

    expect(entry.deliverableId).toBeNull();
    // Which is not the same as absent: the project's list holds it, and the
    // deliverable's list cannot.
    expect(await listTimeEntriesForDeliverable(deliverableId, db)).toEqual([]);
  });

  it("attributes an entry to the line that was picked", async () => {
    const entry = await log({ deliverable: deliverableId });

    expect(entry.deliverableId).toBe(deliverableId);
    const against = await listTimeEntriesForDeliverable(deliverableId, db);
    expect(against.map((row) => row.id)).toEqual([entry.id]);
  });

  it("stores a blank note as nothing", async () => {
    const entry = await log({ note: "   " });

    expect(entry.note).toBeNull();
  });

  it("stores a note at the form's limit", async () => {
    // The column has no ceiling of its own, so the form's is the only one.
    const note = "x".repeat(LOG_TIME_FIELD_LIMITS.note);
    const entry = await log({ note });

    expect(entry.note).toBe(note);
  });

  it("stores an unticked box as non-chargeable", async () => {
    const entry = await log({ billable: "" });

    expect(entry.billable).toBe(false);
  });

  it("writes the shortest entry the form allows", async () => {
    const entry = await log({ duration: "1m" });

    expect(entry.minutes).toBe(1);
  });

  it("writes the longest entry the form allows", async () => {
    // The column refuses zero and negatives; the form refuses anything past a
    // day. This is the boundary both agree on.
    const entry = await log({ duration: "24h" });

    expect(entry.minutes).toBe(MAX_ENTRY_MINUTES);
  });

  it("writes the same minutes however the duration was spelled", async () => {
    for (const duration of ["90", "1h30m", "1h 30m", "1.5h", "1h30", "90m"]) {
      const entry = await log({ duration });
      expect(entry.minutes, duration).toBe(90);
    }
  });

  it("writes a duration the parser rounded", async () => {
    // A fraction of a minute cannot reach the column, which only holds whole
    // ones — so the rounding has to happen in the form, not at the write.
    const entry = await log({ duration: "0.41h" });

    expect(entry.minutes).toBe(25);
  });
});
