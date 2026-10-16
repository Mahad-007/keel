import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { createClient } from "./clients";
import { createDeliverable } from "./deliverables";
import { createProject } from "./projects";
import {
  createTimeEntry,
  getTimeEntry,
  listTimeEntries,
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
