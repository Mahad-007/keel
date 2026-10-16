import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createDeliverable, deleteDeliverable } from "./deliverables";
import {
  createProject,
  deleteProject,
  duplicateProject,
} from "./projects";
import {
  clearTimeEntryBilled,
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntry,
  listTimeEntries,
  listTimeEntriesForDeliverable,
  markTimeEntryBilled,
  updateTimeEntry,
} from "./time-entries";

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

/**
 * `createdAt` comes from the wall clock, so two entries written in the same
 * millisecond would tie and an ordering test would pass or fail by luck.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

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

describe("createTimeEntry defaults", () => {
  it("defaults to billable, because logged time is normally charged", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    expect(entry.billable).toBe(true);
  });

  it("stores a deliberate non-billable entry as such", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", billable: false },
      db,
    );

    expect(entry.billable).toBe(false);
  });

  it("logs an entry unbilled, whatever the flag says", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    expect(entry.billedInvoiceId).toBeNull();
  });

  it("stores an unattributed entry with no deliverable", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    expect(entry.deliverableId).toBeNull();
  });

  it("stores an absent note as NULL", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    expect(entry.note).toBeNull();
  });
});

describe("createTimeEntry text columns", () => {
  it("trims a note", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "  Scoping  " },
      db,
    );

    expect(entry.note).toBe("Scoping");
  });

  it("stores a blank note as NULL rather than as an empty string", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "   " },
      db,
    );

    expect(entry.note).toBeNull();
  });

  it("stores an explicitly null note as NULL", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: null },
      db,
    );

    expect(entry.note).toBeNull();
  });

  it("reads a blank attribution as no attribution", async () => {
    // A form's "no deliverable" option submits an empty string, which means
    // the same thing as the field being absent.
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", deliverableId: "" },
      db,
    );

    expect(entry.deliverableId).toBeNull();
  });

  it("trims surrounding whitespace off the day worked", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: " 2026-10-16 " },
      db,
    );

    expect(entry.workedOn).toBe("2026-10-16");
  });
});

describe("createTimeEntry guards", () => {
  it("refuses an entry against a project that does not exist", async () => {
    await expect(
      createTimeEntry(
        { projectId: "prj_nope", minutes: 60, workedOn: "2026-10-16" },
        db,
      ),
    ).rejects.toThrow("no project with id prj_nope");
  });

  it("refuses a blank project id without a query", async () => {
    await expect(
      createTimeEntry({ projectId: "  ", minutes: 60, workedOn: "2026-10-16" }, db),
    ).rejects.toThrow("time entry project is required");
  });

  it("refuses a duration of zero", async () => {
    await expect(
      createTimeEntry({ projectId, minutes: 0, workedOn: "2026-10-16" }, db),
    ).rejects.toThrow("time entry minutes cannot be zero");
  });

  it("refuses a negative duration", async () => {
    await expect(
      createTimeEntry({ projectId, minutes: -30, workedOn: "2026-10-16" }, db),
    ).rejects.toThrow(/cannot be negative/);
  });

  it("refuses a fractional duration", async () => {
    await expect(
      createTimeEntry({ projectId, minutes: 90.5, workedOn: "2026-10-16" }, db),
    ).rejects.toThrow(/must be whole minutes/);
  });

  it("refuses a day worked that is not a calendar date", async () => {
    await expect(
      createTimeEntry({ projectId, minutes: 60, workedOn: "2026-02-30" }, db),
    ).rejects.toThrow(/time entry worked on must be a calendar date/);
  });

  it("refuses a timestamp as the day worked", async () => {
    await expect(
      createTimeEntry(
        { projectId, minutes: 60, workedOn: "2026-10-16T09:36:00.000Z" },
        db,
      ),
    ).rejects.toThrow(/time entry worked on must be a calendar date/);
  });
});

describe("createTimeEntry attribution", () => {
  it("attributes time to a deliverable of the same project", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );

    const entry = await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 120,
        workedOn: "2026-10-16",
      },
      db,
    );

    expect(entry.deliverableId).toBe(deliverable.id);
  });

  it("refuses a deliverable that does not exist", async () => {
    await expect(
      createTimeEntry(
        {
          projectId,
          deliverableId: "dlv_nope",
          minutes: 60,
          workedOn: "2026-10-16",
        },
        db,
      ),
    ).rejects.toThrow("no deliverable with id dlv_nope");
  });

  it("refuses a deliverable belonging to another project", async () => {
    const other = await createProject(
      { clientId: (await createClient({ name: "Beam Ltd" }, db)).id, name: "Other" },
      db,
    );
    const theirs = await createDeliverable(
      { projectId: other.id, title: "Their work" },
      db,
    );

    await expect(
      createTimeEntry(
        {
          projectId,
          deliverableId: theirs.id,
          minutes: 60,
          workedOn: "2026-10-16",
        },
        db,
      ),
    ).rejects.toThrow(
      `deliverable ${theirs.id} does not belong to project ${projectId}`,
    );
  });
});

describe("getTimeEntry", () => {
  it("reads back an entry that was written", async () => {
    const written = await createTimeEntry(
      { projectId, minutes: 45, workedOn: "2026-10-16", note: "Email" },
      db,
    );

    expect(await getTimeEntry(written.id, db)).toEqual(written);
  });

  it("is null for an id nothing was written under", async () => {
    expect(await getTimeEntry("tme_nope", db)).toBeNull();
  });

  it("reads the billable flag back as a boolean, not as a 1", async () => {
    const written = await createTimeEntry(
      { projectId, minutes: 45, workedOn: "2026-10-16" },
      db,
    );

    const read = await getTimeEntry(written.id, db);
    expect(read?.billable).toBe(true);
  });
});

describe("listTimeEntries", () => {
  it("is empty for a project nothing has been logged against", async () => {
    expect(await listTimeEntries(projectId, db)).toEqual([]);
  });

  it("reads the most recent day's work first", async () => {
    await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-14", note: "Monday" },
      db,
    );
    await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "Wednesday" },
      db,
    );
    await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-15", note: "Tuesday" },
      db,
    );

    const list = await listTimeEntries(projectId, db);
    expect(list.map((entry) => entry.note)).toEqual([
      "Wednesday",
      "Tuesday",
      "Monday",
    ]);
  });

  it("reads the last entry typed first within one day", async () => {
    const first = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "Call" },
      db,
    );
    await tick();
    const second = await createTimeEntry(
      { projectId, minutes: 30, workedOn: "2026-10-16", note: "Notes after" },
      db,
    );

    const list = await listTimeEntries(projectId, db);
    expect(list.map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it("leaves out another project's time", async () => {
    const other = await createProject(
      {
        clientId: (await createClient({ name: "Beam Ltd" }, db)).id,
        name: "Other",
      },
      db,
    );
    await createTimeEntry(
      { projectId: other.id, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    const mine = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    const list = await listTimeEntries(projectId, db);
    expect(list.map((entry) => entry.id)).toEqual([mine.id]);
  });

  it("writes nothing when a guard refuses", async () => {
    await expect(
      createTimeEntry({ projectId, minutes: 0, workedOn: "2026-10-16" }, db),
    ).rejects.toThrow();

    expect(await listTimeEntries(projectId, db)).toEqual([]);
  });
});

describe("listTimeEntriesForDeliverable", () => {
  it("is empty for a deliverable nothing has been logged against", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );

    expect(await listTimeEntriesForDeliverable(deliverable.id, db)).toEqual([]);
  });

  it("reads only the entries attributed to that deliverable", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const build = await createDeliverable({ projectId, title: "Build" }, db);
    const mine = await createTimeEntry(
      {
        projectId,
        deliverableId: discovery.id,
        minutes: 60,
        workedOn: "2026-10-16",
      },
      db,
    );
    await createTimeEntry(
      {
        projectId,
        deliverableId: build.id,
        minutes: 60,
        workedOn: "2026-10-16",
      },
      db,
    );
    await createTimeEntry({ projectId, minutes: 60, workedOn: "2026-10-16" }, db);

    const list = await listTimeEntriesForDeliverable(discovery.id, db);
    expect(list.map((entry) => entry.id)).toEqual([mine.id]);
  });

  it("reads the most recent day's work first", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    for (const workedOn of ["2026-10-14", "2026-10-16", "2026-10-15"]) {
      await createTimeEntry(
        { projectId, deliverableId: deliverable.id, minutes: 60, workedOn },
        db,
      );
    }

    const list = await listTimeEntriesForDeliverable(deliverable.id, db);
    expect(list.map((entry) => entry.workedOn)).toEqual([
      "2026-10-16",
      "2026-10-15",
      "2026-10-14",
    ]);
  });
});

describe("updateTimeEntry", () => {
  /** An ordinary unbilled entry, which is what most of these start from. */
  async function logged() {
    return createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "Call" },
      db,
    );
  }

  it("writes the fields the patch names", async () => {
    const entry = await logged();

    const result = await updateTimeEntry(
      entry.id,
      { minutes: 120, note: "Call and notes" },
      db,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.entry.minutes).toBe(120);
    expect(result.ok && result.entry.note).toBe("Call and notes");
  });

  it("leaves the fields the patch does not name", async () => {
    const entry = await logged();

    await updateTimeEntry(entry.id, { minutes: 120 }, db);

    const read = await getTimeEntry(entry.id, db);
    expect(read?.note).toBe("Call");
    expect(read?.workedOn).toBe("2026-10-16");
    expect(read?.billable).toBe(true);
  });

  it("writes the change, so the next read agrees with it", async () => {
    const entry = await logged();

    await updateTimeEntry(entry.id, { workedOn: "2026-10-15" }, db);

    expect((await getTimeEntry(entry.id, db))?.workedOn).toBe("2026-10-15");
  });

  it("marks an entry non-billable", async () => {
    const entry = await logged();

    const result = await updateTimeEntry(entry.id, { billable: false }, db);

    expect(result.ok && result.entry.billable).toBe(false);
  });

  it("clears a note back to NULL", async () => {
    const entry = await logged();

    const result = await updateTimeEntry(entry.id, { note: "  " }, db);

    expect(result.ok && result.entry.note).toBeNull();
  });

  it("refuses an id nothing was written under", async () => {
    const result = await updateTimeEntry("tme_nope", { minutes: 30 }, db);

    expect(result).toEqual({ ok: false, refusal: "no-such-entry" });
  });
});

describe("updateTimeEntry with nothing to write", () => {
  it("hands back the row unchanged", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    const result = await updateTimeEntry(entry.id, {}, db);

    expect(result).toEqual({ ok: true, entry });
  });

  it("does not bump updatedAt, so an untouched entry looks untouched", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await tick();

    await updateTimeEntry(entry.id, {}, db);

    expect((await getTimeEntry(entry.id, db))?.updatedAt).toBe(entry.updatedAt);
  });

  it("still refuses an id nothing was written under", async () => {
    expect(await updateTimeEntry("tme_nope", {}, db)).toEqual({
      ok: false,
      refusal: "no-such-entry",
    });
  });
});

describe("updateTimeEntry guards", () => {
  async function logged() {
    return createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
  }

  it("refuses a duration of zero", async () => {
    const entry = await logged();

    await expect(updateTimeEntry(entry.id, { minutes: 0 }, db)).rejects.toThrow(
      "time entry minutes cannot be zero",
    );
  });

  it("refuses a negative duration", async () => {
    const entry = await logged();

    await expect(
      updateTimeEntry(entry.id, { minutes: -15 }, db),
    ).rejects.toThrow(/cannot be negative/);
  });

  it("refuses a day worked that is not a calendar date", async () => {
    const entry = await logged();

    await expect(
      updateTimeEntry(entry.id, { workedOn: "2026-10-16T09:00:00.000Z" }, db),
    ).rejects.toThrow(/must be a calendar date/);
  });

  it("writes nothing when a guard refuses", async () => {
    const entry = await logged();

    await expect(
      updateTimeEntry(entry.id, { minutes: 0, note: "Would have stuck" }, db),
    ).rejects.toThrow();

    expect((await getTimeEntry(entry.id, db))?.note).toBeNull();
  });
});

describe("updateTimeEntry attribution", () => {
  it("attributes previously unattributed time to a line of scope", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );

    const result = await updateTimeEntry(
      entry.id,
      { deliverableId: deliverable.id },
      db,
    );

    expect(result.ok && result.entry.deliverableId).toBe(deliverable.id);
  });

  it("moves time from one line of the project to another", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const build = await createDeliverable({ projectId, title: "Build" }, db);
    const entry = await createTimeEntry(
      {
        projectId,
        deliverableId: discovery.id,
        minutes: 60,
        workedOn: "2026-10-16",
      },
      db,
    );

    await updateTimeEntry(entry.id, { deliverableId: build.id }, db);

    expect(await listTimeEntriesForDeliverable(discovery.id, db)).toEqual([]);
    expect(
      (await listTimeEntriesForDeliverable(build.id, db)).map((row) => row.id),
    ).toEqual([entry.id]);
  });

  it("clears an attribution back to project-level work", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const entry = await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 60,
        workedOn: "2026-10-16",
      },
      db,
    );

    const result = await updateTimeEntry(entry.id, { deliverableId: null }, db);

    expect(result.ok && result.entry.deliverableId).toBeNull();
  });

  it("reads a blank attribution as clearing it", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const entry = await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 60,
        workedOn: "2026-10-16",
      },
      db,
    );

    const result = await updateTimeEntry(entry.id, { deliverableId: "" }, db);

    expect(result.ok && result.entry.deliverableId).toBeNull();
  });

  it("refuses a line of scope that has been dropped since", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    await deleteDeliverable(deliverable.id, db);

    const result = await updateTimeEntry(
      entry.id,
      { deliverableId: deliverable.id },
      db,
    );

    expect(result).toEqual({ ok: false, refusal: "no-such-deliverable" });
  });

  it("refuses a deliverable id nothing was ever written under", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    expect(
      await updateTimeEntry(entry.id, { deliverableId: "dlv_nope" }, db),
    ).toEqual({ ok: false, refusal: "no-such-deliverable" });
  });

  it("refuses a deliverable belonging to another project", async () => {
    const other = await createProject(
      {
        clientId: (await createClient({ name: "Beam Ltd" }, db)).id,
        name: "Other",
      },
      db,
    );
    const theirs = await createDeliverable(
      { projectId: other.id, title: "Their work" },
      db,
    );
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    await expect(
      updateTimeEntry(entry.id, { deliverableId: theirs.id }, db),
    ).rejects.toThrow(/does not belong to project/);
  });

  it("writes nothing when the attribution is refused", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    await updateTimeEntry(
      entry.id,
      { minutes: 30, deliverableId: "dlv_nope" },
      db,
    );

    expect((await getTimeEntry(entry.id, db))?.minutes).toBe(60);
  });

  it("writes nothing when another project's line is refused", async () => {
    const other = await createProject(
      {
        clientId: (await createClient({ name: "Beam Ltd" }, db)).id,
        name: "Other",
      },
      db,
    );
    const theirs = await createDeliverable(
      { projectId: other.id, title: "Their work" },
      db,
    );
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    await expect(
      updateTimeEntry(entry.id, { minutes: 30, deliverableId: theirs.id }, db),
    ).rejects.toThrow();

    expect((await getTimeEntry(entry.id, db))?.minutes).toBe(60);
  });
});

describe("markTimeEntryBilled", () => {
  async function logged(billable = true) {
    return createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", billable },
      db,
    );
  }

  it("records which invoice billed the time", async () => {
    const entry = await logged();

    const marked = await markTimeEntryBilled(entry.id, "inv_0001", db);

    expect(marked?.billedInvoiceId).toBe("inv_0001");
  });

  it("writes the change, so the next read agrees with it", async () => {
    const entry = await logged();

    await markTimeEntryBilled(entry.id, "inv_0001", db);

    expect((await getTimeEntry(entry.id, db))?.billedInvoiceId).toBe(
      "inv_0001",
    );
  });

  it("refuses time somebody marked non-billable", async () => {
    const entry = await logged(false);

    expect(await markTimeEntryBilled(entry.id, "inv_0001", db)).toBeNull();
    expect((await getTimeEntry(entry.id, db))?.billedInvoiceId).toBeNull();
  });

  it("refuses an hour a second invoice tries to claim", async () => {
    const entry = await logged();
    await markTimeEntryBilled(entry.id, "inv_0001", db);

    expect(await markTimeEntryBilled(entry.id, "inv_0002", db)).toBeNull();
    expect((await getTimeEntry(entry.id, db))?.billedInvoiceId).toBe(
      "inv_0001",
    );
  });

  it("lets the same invoice finish a send it had started", async () => {
    const entry = await logged();
    await markTimeEntryBilled(entry.id, "inv_0001", db);

    const again = await markTimeEntryBilled(entry.id, "inv_0001", db);

    expect(again?.billedInvoiceId).toBe("inv_0001");
  });

  it("does not bump updatedAt when it already had the time", async () => {
    const entry = await logged();
    const marked = await markTimeEntryBilled(entry.id, "inv_0001", db);
    await tick();

    await markTimeEntryBilled(entry.id, "inv_0001", db);

    expect((await getTimeEntry(entry.id, db))?.updatedAt).toBe(
      marked?.updatedAt,
    );
  });

  it("is null for an id nothing was written under", async () => {
    expect(await markTimeEntryBilled("tme_nope", "inv_0001", db)).toBeNull();
  });

  it("refuses an invoice id that names nothing", async () => {
    const entry = await logged();

    await expect(markTimeEntryBilled(entry.id, "  ", db)).rejects.toThrow(
      "billed invoice is required",
    );
  });
});

describe("updateTimeEntry on billed time", () => {
  /** An entry an invoice has already charged for. */
  async function billed() {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "Call" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    return entry;
  }

  it("refuses the minutes an invoice has charged for", async () => {
    const entry = await billed();

    const result = await updateTimeEntry(entry.id, { minutes: 120 }, db);

    expect(result).toEqual({ ok: false, refusal: "billed" });
    expect((await getTimeEntry(entry.id, db))?.minutes).toBe(60);
  });

  it("refuses the day an invoice dated the work to", async () => {
    const entry = await billed();

    expect(
      await updateTimeEntry(entry.id, { workedOn: "2026-10-01" }, db),
    ).toEqual({ ok: false, refusal: "billed" });
  });

  it("refuses billed time being marked non-billable", async () => {
    const entry = await billed();

    expect(await updateTimeEntry(entry.id, { billable: false }, db)).toEqual({
      ok: false,
      refusal: "billed",
    });
  });

  it("refuses moving billed time to another line of scope", async () => {
    const entry = await billed();
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );

    expect(
      await updateTimeEntry(entry.id, { deliverableId: deliverable.id }, db),
    ).toEqual({ ok: false, refusal: "billed" });
  });

  it("refuses the whole patch when one field of it is frozen", async () => {
    const entry = await billed();

    await updateTimeEntry(entry.id, { note: "Reworded", minutes: 30 }, db);

    expect((await getTimeEntry(entry.id, db))?.note).toBe("Call");
  });

  it("still lets the note be corrected", async () => {
    const entry = await billed();

    const result = await updateTimeEntry(
      entry.id,
      { note: "Call with Priya" },
      db,
    );

    expect(result.ok && result.entry.note).toBe("Call with Priya");
  });

  it("refuses the minutes even when they are the ones already stored", async () => {
    const entry = await billed();

    expect(await updateTimeEntry(entry.id, { minutes: 60 }, db)).toEqual({
      ok: false,
      refusal: "billed",
    });
  });
});

describe("clearTimeEntryBilled", () => {
  it("frees time the invoice had billed", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);

    const freed = await clearTimeEntryBilled(entry.id, "inv_0001", db);

    expect(freed?.billedInvoiceId).toBeNull();
    expect((await getTimeEntry(entry.id, db))?.billedInvoiceId).toBeNull();
  });

  it("lets a freed entry be edited again", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    await clearTimeEntryBilled(entry.id, "inv_0001", db);

    const result = await updateTimeEntry(entry.id, { minutes: 120 }, db);

    expect(result.ok && result.entry.minutes).toBe(120);
  });

  it("lets the next invoice bill the freed hour", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    await clearTimeEntryBilled(entry.id, "inv_0001", db);

    const marked = await markTimeEntryBilled(entry.id, "inv_0002", db);

    expect(marked?.billedInvoiceId).toBe("inv_0002");
  });

  it("leaves the billable flag alone", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);

    const freed = await clearTimeEntryBilled(entry.id, "inv_0001", db);

    expect(freed?.billable).toBe(true);
  });

  it("refuses to free time another invoice has since billed", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    await clearTimeEntryBilled(entry.id, "inv_0001", db);
    await markTimeEntryBilled(entry.id, "inv_0002", db);

    expect(await clearTimeEntryBilled(entry.id, "inv_0001", db)).toBeNull();
    expect((await getTimeEntry(entry.id, db))?.billedInvoiceId).toBe(
      "inv_0002",
    );
  });

  it("refuses an invoice id that names nothing", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);

    await expect(clearTimeEntryBilled(entry.id, "  ", db)).rejects.toThrow(
      "billed invoice is required",
    );
  });

  it("is null when the entry was not billed in the first place", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    expect(await clearTimeEntryBilled(entry.id, "inv_0001", db)).toBeNull();
  });

  it("does not bump updatedAt when there was nothing to free", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await tick();

    await clearTimeEntryBilled(entry.id, "inv_0001", db);

    expect((await getTimeEntry(entry.id, db))?.updatedAt).toBe(entry.updatedAt);
  });

  it("is null for an id nothing was written under", async () => {
    expect(await clearTimeEntryBilled("tme_nope", "inv_0001", db)).toBeNull();
  });
});

describe("deleteTimeEntry", () => {
  it("hands back the row it removed", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16", note: "Mistyped" },
      db,
    );

    const result = await deleteTimeEntry(entry.id, db);

    expect(result).toEqual({ ok: true, entry });
  });

  it("removes it, so the next read does not find it", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    await deleteTimeEntry(entry.id, db);

    expect(await getTimeEntry(entry.id, db)).toBeNull();
    expect(await listTimeEntries(projectId, db)).toEqual([]);
  });

  it("leaves the project's other entries alone", async () => {
    const doomed = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    const kept = await createTimeEntry(
      { projectId, minutes: 30, workedOn: "2026-10-15" },
      db,
    );

    await deleteTimeEntry(doomed.id, db);

    expect((await listTimeEntries(projectId, db)).map((row) => row.id)).toEqual(
      [kept.id],
    );
  });

  it("refuses an id nothing was written under", async () => {
    expect(await deleteTimeEntry("tme_nope", db)).toEqual({
      ok: false,
      refusal: "no-such-entry",
    });
  });

  it("refuses time an invoice has charged for", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);

    const result = await deleteTimeEntry(entry.id, db);

    expect(result).toEqual({ ok: false, refusal: "billed" });
    expect(await getTimeEntry(entry.id, db)).not.toBeNull();
  });

  it("removes it once a credit note has freed the time", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    await clearTimeEntryBilled(entry.id, "inv_0001", db);

    expect((await deleteTimeEntry(entry.id, db)).ok).toBe(true);
    expect(await getTimeEntry(entry.id, db)).toBeNull();
  });
});

describe("project cascade", () => {
  it("takes a project's time with it", async () => {
    const other = await createProject(
      {
        clientId: (await createClient({ name: "Beam Ltd" }, db)).id,
        name: "Doomed",
      },
      db,
    );
    const going = await createTimeEntry(
      { projectId: other.id, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    const kept = await createTimeEntry(
      { projectId, minutes: 60, workedOn: "2026-10-16" },
      db,
    );

    await deleteProject(other.id, db);

    expect(await getTimeEntry(going.id, db)).toBeNull();
    expect(await getTimeEntry(kept.id, db)).not.toBeNull();
  });
});

describe("deliverable deletion", () => {
  it("keeps the time and drops only the attribution", async () => {
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const entry = await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 120,
        workedOn: "2026-10-16",
      },
      db,
    );

    await deleteDeliverable(deliverable.id, db);

    const read = await getTimeEntry(entry.id, db);
    expect(read?.minutes).toBe(120);
    expect(read?.projectId).toBe(projectId);
    expect(read?.deliverableId).toBeNull();
  });

  it("leaves the hours counting against the project", async () => {
    // Dropping a line of scope must not quietly reduce what the engagement
    // has cost: the work was still done and still has to be accounted for.
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 120,
        workedOn: "2026-10-16",
      },
      db,
    );

    await deleteDeliverable(deliverable.id, db);

    const list = await listTimeEntries(projectId, db);
    expect(list.map((row) => row.minutes)).toEqual([120]);
  });

  it("leaves another line's attribution alone", async () => {
    const discovery = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const build = await createDeliverable({ projectId, title: "Build" }, db);
    const kept = await createTimeEntry(
      {
        projectId,
        deliverableId: build.id,
        minutes: 60,
        workedOn: "2026-10-16",
      },
      db,
    );

    await deleteDeliverable(discovery.id, db);

    expect((await getTimeEntry(kept.id, db))?.deliverableId).toBe(build.id);
  });
});

describe("project duplication", () => {
  it("does not carry a project's time onto the copy", async () => {
    // Day 018 promised this and could not test it: the table did not exist
    // yet. Scope is a plan worth starting the next engagement from; the hours
    // spent on the first one are a fact about that one.
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    await createTimeEntry(
      {
        projectId,
        deliverableId: deliverable.id,
        minutes: 120,
        workedOn: "2026-10-16",
      },
      db,
    );

    const result = await duplicateProject(projectId, { name: "Round two" }, db);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await listTimeEntries(result.project.id, db)).toEqual([]);
    expect(
      await listTimeEntriesForDeliverable(result.deliverables[0].id, db),
    ).toEqual([]);
  });

  it("leaves the original's time where it was", async () => {
    const entry = await createTimeEntry(
      { projectId, minutes: 120, workedOn: "2026-10-16" },
      db,
    );

    await duplicateProject(projectId, { name: "Round two" }, db);

    expect((await listTimeEntries(projectId, db)).map((row) => row.id)).toEqual(
      [entry.id],
    );
  });
});

describe("the cascades that outrank the billed guard", () => {
  /** An entry attributed to a line of scope and already invoiced. */
  async function billedAgainst(deliverableId: string) {
    const entry = await createTimeEntry(
      { projectId, deliverableId, minutes: 120, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    return entry;
  }

  it("moves a billed entry's attribution when the line is dropped", async () => {
    // `updateTimeEntry` refuses exactly this change, and the foreign key makes
    // it anyway. Pinned rather than guarded: refusing would mean a line of
    // scope can never be dropped once any of its time is billed, and the hours
    // matter more than the grouping.
    const deliverable = await createDeliverable(
      { projectId, title: "Discovery" },
      db,
    );
    const entry = await billedAgainst(deliverable.id);
    expect(
      await updateTimeEntry(entry.id, { deliverableId: null }, db),
    ).toEqual({ ok: false, refusal: "billed" });

    await deleteDeliverable(deliverable.id, db);

    const read = await getTimeEntry(entry.id, db);
    expect(read?.deliverableId).toBeNull();
    expect(read?.minutes).toBe(120);
    expect(read?.billedInvoiceId).toBe("inv_0001");
  });

  it("takes billed time with the project it belongs to", async () => {
    // `deleteTimeEntry` refuses to remove billed time one entry at a time,
    // and deleting the project removes all of it. Phase 6 is where that gets
    // a guard, because an issued invoice is the thing that should stop a
    // project being deleted — see NOTES.md.
    const other = await createProject(
      {
        clientId: (await createClient({ name: "Beam Ltd" }, db)).id,
        name: "Invoiced and doomed",
      },
      db,
    );
    const entry = await createTimeEntry(
      { projectId: other.id, minutes: 60, workedOn: "2026-10-16" },
      db,
    );
    await markTimeEntryBilled(entry.id, "inv_0001", db);
    expect(await deleteTimeEntry(entry.id, db)).toEqual({
      ok: false,
      refusal: "billed",
    });

    await deleteProject(other.id, db);

    expect(await getTimeEntry(entry.id, db)).toBeNull();
  });
});
