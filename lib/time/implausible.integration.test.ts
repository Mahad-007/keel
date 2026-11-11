import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createProject } from "@/lib/data/projects";
import { createTimeEntry, listTimeEntries } from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { timeEntries } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";
import { newId } from "@/lib/id";

import { suggestedMinutes } from "./correct";
import { flagImplausibleEntries } from "./implausible";

/**
 * The flags against rows a real database holds, rather than against objects a
 * test wrote.
 *
 * Two things this proves that the unit tests cannot. The first is that the
 * durations the flags are about can get into the table at all: `MAX_ENTRY_MINUTES`
 * caps one entry at a day, so the twelve-hour flag has a window to work in,
 * and `positiveMinutes` refuses a negative one outright — which is why the
 * negative case has to be inserted behind the data layer, and why it is worth
 * knowing that it still reads back as a flag rather than as a crash.
 *
 * The second is the order. The flags come back in the order the query handed
 * the rows over, because the caveats have to line up with a list nothing here
 * re-sorts.
 */

let db: Database;
let projectId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  const project = await createProject(
    { clientId: client.id, name: "Engine rewrite" },
    db,
  );
  projectId = project.id;
});

/** A row the forms could not have produced, written straight to the table. */
async function writeDirectly(minutes: number, workedOn: string) {
  await db
    .insert(timeEntries)
    .values({ id: newId("tme"), projectId, minutes, workedOn });
}

describe("flagging what a project's time table actually holds", () => {
  it("finds nothing wrong with an ordinary week", async () => {
    await createTimeEntry({ projectId, minutes: 420, workedOn: "2026-10-16" }, db);
    await createTimeEntry({ projectId, minutes: 390, workedOn: "2026-10-17" }, db);

    expect(flagImplausibleEntries(await listTimeEntries(projectId, db))).toEqual(
      [],
    );
  });

  it("flags a thirteen-hour entry the form accepted", async () => {
    // Under the one-day ceiling the form enforces, so it is a figure that
    // really does reach the table.
    await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17" },
      db,
    );

    const flagged = flagImplausibleEntries(await listTimeEntries(projectId, db));

    expect(flagged).toHaveLength(1);
    expect(flagged[0].problems).toEqual([{ reason: "overlong" }]);
    expect(suggestedMinutes(flagged[0].entry)).toBe(13);
  });

  it("flags a negative row no form would have written", async () => {
    await writeDirectly(-90, "2026-10-17");

    const flagged = flagImplausibleEntries(await listTimeEntries(projectId, db));

    expect(flagged[0].problems).toEqual([{ reason: "negative" }]);
    expect(suggestedMinutes(flagged[0].entry)).toBe(90);
  });

  it("flags both entries of a day two long stretches overfill", async () => {
    await createTimeEntry(
      { projectId, minutes: 14 * 60, workedOn: "2026-10-17" },
      db,
    );
    await createTimeEntry(
      { projectId, minutes: 11 * 60, workedOn: "2026-10-17" },
      db,
    );

    const flagged = flagImplausibleEntries(await listTimeEntries(projectId, db));

    expect(flagged).toHaveLength(2);
    expect(
      flagged.every(({ problems }) =>
        problems.some((problem) => problem.reason === "overlapping"),
      ),
    ).toBe(true);
  });

  it("flags in the order the query handed the rows over", async () => {
    await writeDirectly(-30, "2026-10-14");
    await writeDirectly(-30, "2026-10-17");
    await writeDirectly(-30, "2026-10-16");

    const entries = await listTimeEntries(projectId, db);
    const flagged = flagImplausibleEntries(entries);

    expect(flagged.map(({ entry }) => entry.workedOn)).toEqual(
      entries.map((entry) => entry.workedOn),
    );
  });
});
