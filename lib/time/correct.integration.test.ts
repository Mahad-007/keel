import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createProject } from "@/lib/data/projects";
import {
  createTimeEntry,
  listTimeEntries,
  updateTimeEntry,
} from "@/lib/data/time-entries";
import type { Database } from "@/lib/db";
import { timeEntries } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";
import { newId } from "@/lib/id";

import { correctedTimeFields, offeredCorrection } from "./correct";
import { changesTimeEntry, timeEntryChanges } from "./edit";
import { parseLogTimeForm } from "./form";
import { flagImplausibleEntries } from "./implausible";

/**
 * The whole of the offer, end to end: a flagged row, the figure suggested for
 * it, the boxes the editor opens with, the save those boxes make, and the flag
 * gone afterwards.
 *
 * It is the only test that can say the fix actually fixes anything. Every step
 * is tested where it lives — the guess, the prefill, the validation, the
 * update — and the thing none of them can check is that the figure the button
 * names survives the form it is typed into and the column it lands in. A
 * suggestion the editor's own validation would refuse, or one that leaves the
 * caveat exactly where it was, is a button that makes the page look broken.
 *
 * The save goes through `parseLogTimeForm` and `timeEntryChanges` rather than
 * round the side of them, because that is the path the Save button takes.
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

/** The press, the form, and the save, as the page performs them in sequence. */
async function applyTheOffer(id: string) {
  const [entry] = (await listTimeEntries(projectId, db)).filter(
    (one) => one.id === id,
  );

  const suggested = offeredCorrection(entry);
  if (suggested === null) throw new Error("nothing was offered");

  const parsed = parseLogTimeForm(correctedTimeFields(entry, suggested), []);
  if (!parsed.ok) throw new Error("the editor refused its own prefill");

  const patch = timeEntryChanges(entry, parsed.value);
  expect(changesTimeEntry(patch)).toBe(true);
  // Only the duration moves, which is what makes this a correction rather
  // than a re-entry of the row.
  expect(Object.keys(patch)).toEqual(["minutes"]);

  const result = await updateTimeEntry(entry.id, patch, db);
  if (!result.ok) throw new Error(`the save was refused: ${result.refusal}`);
  return result.entry;
}

describe("applying the offered correction", () => {
  it("turns a slipped unit into the minutes it meant, and clears the flag", async () => {
    const logged = await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17", note: "Billing" },
      db,
    );

    const corrected = await applyTheOffer(logged.id);

    expect(corrected.minutes).toBe(13);
    expect(flagImplausibleEntries(await listTimeEntries(projectId, db))).toEqual(
      [],
    );
  });

  it("leaves the day, the note and the attribution exactly as they were", async () => {
    const logged = await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17", note: "Billing" },
      db,
    );

    const corrected = await applyTheOffer(logged.id);

    expect(corrected.workedOn).toBe("2026-10-17");
    expect(corrected.note).toBe("Billing");
    expect(corrected.deliverableId).toBeNull();
    expect(corrected.billable).toBe(true);
  });

  it("turns a negative row into the time it recorded", async () => {
    const id = newId("tme");
    await db
      .insert(timeEntries)
      .values({ id, projectId, minutes: -90, workedOn: "2026-10-17" });

    const corrected = await applyTheOffer(id);

    expect(corrected.minutes).toBe(90);
    expect(flagImplausibleEntries(await listTimeEntries(projectId, db))).toEqual(
      [],
    );
  });

  it("clears a day's overlap along with the row that caused it", async () => {
    // Two thirteen-hour entries overfill one day. Correcting either takes the
    // day back under twenty-four hours, so the entry left behind keeps its own
    // flag and loses the one it only had through its neighbour.
    await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17" },
      db,
    );
    const second = await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17" },
      db,
    );

    await applyTheOffer(second.id);

    const flagged = flagImplausibleEntries(
      await listTimeEntries(projectId, db),
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0].problems).toEqual([{ reason: "overlong" }]);
  });

  it("leaves a day's own flag standing when one fix is not enough", async () => {
    // Three thirteen-hour entries. Correcting one leaves 26h on the day, so
    // every entry on it stays flagged for the overlap — including the one just
    // corrected, which is now thirteen honest minutes on an impossible day.
    // That is the reason the offer is per entry and the day's flag is not.
    await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17" },
      db,
    );
    await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17" },
      db,
    );
    const third = await createTimeEntry(
      { projectId, minutes: 13 * 60, workedOn: "2026-10-17" },
      db,
    );

    const corrected = await applyTheOffer(third.id);

    const flagged = flagImplausibleEntries(
      await listTimeEntries(projectId, db),
    );
    expect(flagged).toHaveLength(3);
    expect(
      flagged.every(({ problems }) =>
        problems.some((problem) => problem.reason === "overlapping"),
      ),
    ).toBe(true);

    const [stillFlagged] = flagged.filter(
      ({ entry }) => entry.id === corrected.id,
    );
    expect(stillFlagged.problems).toEqual([
      { reason: "overlapping", dayMinutes: 26 * 60 + 13 },
    ]);
  });
});
