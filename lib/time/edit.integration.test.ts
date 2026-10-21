import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createDeliverable } from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import {
  createTimeEntry,
  getTimeEntry,
  markTimeEntryBilled,
  updateTimeEntry,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import type { TimeEntry } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import {
  changesTimeEntry,
  timeEntryChanges,
  timeEntryFormFields,
} from "./edit";
import { parseLogTimeForm, type LogTimeFormFields } from "./form";

/**
 * The round trip an edit actually makes: a stored row into a form, the form
 * back into a patch, the patch into the row.
 *
 * Each half is tested on its own. What only shows here is whether the two
 * agree over values a real column held — a duration the data layer rounded, a
 * note it trimmed, a blank attribution it stored as NULL. An edit form that
 * opens on a row and saves it untouched must write nothing at all, and the
 * only way to know is to do it against the database.
 */

let db: Database;
let projectId: string;
let deliverableId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Engine rewrite" },
    db,
  );
  projectId = project.id;
  const deliverable = await createDeliverable(
    { projectId, title: "Wireframes" },
    db,
  );
  deliverableId = deliverable.id;
});

/** The form as it opens on a stored row, then read back as a patch. */
function patchFor(entry: TimeEntry, typed: Partial<LogTimeFormFields> = {}) {
  const parsed = parseLogTimeForm(
    { ...timeEntryFormFields(entry), ...typed },
    [deliverableId],
  );
  if (!parsed.ok) throw new Error("the prefilled form was refused");
  return timeEntryChanges(entry, parsed.value);
}

describe("an entry opened for editing and saved untouched", () => {
  it("asks for no change at all", async () => {
    const entry = await createTimeEntry(
      {
        projectId,
        deliverableId,
        minutes: 95,
        note: "Paired on the booking flow",
        workedOn: "2026-10-17",
        billable: false,
      },
      db,
    );

    expect(changesTimeEntry(patchFor(entry))).toBe(false);
  });

  it("asks for no change for unattributed, note-less, chargeable time", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 30, workedOn: "2026-10-17" },
      db,
    );

    expect(patchFor(entry)).toEqual({});
  });

  it("leaves `updatedAt` alone, so the row does not look edited", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17" },
      db,
    );

    const result = await updateTimeEntry(entry.id, patchFor(entry), db);

    expect(result.ok).toBe(true);
    const after = await getTimeEntry(entry.id, db);
    expect(after?.updatedAt).toBe(entry.updatedAt);
  });
});

describe("an entry opened for editing and changed", () => {
  it("writes the new duration and nothing else", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, note: "Booking flow", workedOn: "2026-10-17" },
      db,
    );

    const result = await updateTimeEntry(
      entry.id,
      patchFor(entry, { duration: "2h 15m" }),
      db,
    );

    expect(result.ok && result.entry.minutes).toBe(135);
    expect(result.ok && result.entry.note).toBe("Booking flow");
    expect(result.ok && result.entry.workedOn).toBe("2026-10-17");
  });

  it("reopens on the row it just wrote, asking for nothing again", async () => {
    // The property that makes a second save of the same edit a no-op rather
    // than a write: what came out of the column goes back into the form.
    const entry = await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17" },
      db,
    );
    const result = await updateTimeEntry(
      entry.id,
      patchFor(entry, { duration: "2h 15m" }),
      db,
    );
    if (!result.ok) throw new Error("the edit was refused");

    expect(patchFor(result.entry)).toEqual({});
  });

  it("moves the attribution onto a line and back off again", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17" },
      db,
    );

    const onto = await updateTimeEntry(
      entry.id,
      patchFor(entry, { deliverable: deliverableId }),
      db,
    );
    if (!onto.ok) throw new Error("the edit was refused");
    expect(onto.entry.deliverableId).toBe(deliverableId);

    const off = await updateTimeEntry(
      onto.entry.id,
      patchFor(onto.entry, { deliverable: "" }),
      db,
    );
    expect(off.ok && off.entry.deliverableId).toBeNull();
  });

  it("clears a note the reader emptied", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, note: "Booking flow", workedOn: "2026-10-17" },
      db,
    );

    const result = await updateTimeEntry(
      entry.id,
      patchFor(entry, { note: "   " }),
      db,
    );

    expect(result.ok && result.entry.note).toBeNull();
  });

  it("re-dates an entry filed under the wrong day", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17" },
      db,
    );

    const result = await updateTimeEntry(
      entry.id,
      patchFor(entry, { workedOn: "2026-10-16" }),
      db,
    );

    expect(result.ok && result.entry.workedOn).toBe("2026-10-16");
  });

  it("unticks the chargeable flag without touching the minutes", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17" },
      db,
    );

    const result = await updateTimeEntry(
      entry.id,
      patchFor(entry, { billable: "" }),
      db,
    );

    expect(result.ok && result.entry.billable).toBe(false);
    expect(result.ok && result.entry.minutes).toBe(90);
  });
});

describe("an entry an invoice has billed", () => {
  it("refuses the patch the form would have made", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 90, workedOn: "2026-10-17" },
      db,
    );
    const billed = await markTimeEntryBilled(entry.id, "inv_7", db);
    if (billed === null) throw new Error("the entry was not billed");

    const result = await updateTimeEntry(
      billed.id,
      patchFor(billed, { duration: "2h" }),
      db,
    );

    expect(result).toEqual({ ok: false, refusal: "billed" });
  });

  it("takes a correction to the note, which no invoice reads a figure from", async () => {
    // The data layer allows this. The list deliberately does not offer it —
    // see `canChangeEntry` — but the rule underneath has to stay the one the
    // billing module states, or Phase 6 inherits a rule nobody wrote down.
    const entry = await createTimeEntry(
      { projectId, minutes: 90, note: "Clled client", workedOn: "2026-10-17" },
      db,
    );
    const billed = await markTimeEntryBilled(entry.id, "inv_7", db);
    if (billed === null) throw new Error("the entry was not billed");

    const result = await updateTimeEntry(
      billed.id,
      patchFor(billed, { note: "Called client" }),
      db,
    );

    expect(result.ok && result.entry.note).toBe("Called client");
  });
});
