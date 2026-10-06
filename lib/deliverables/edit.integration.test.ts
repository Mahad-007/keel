import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import {
  createDeliverable,
  getDeliverable,
  updateDeliverable,
} from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import type { Deliverable } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/testing";

import { changesDeliverable, deliverableChanges } from "./edit";
import { deliverableFormFields, parseDeliverableForm } from "./form";

/**
 * The seam between an edit form and the row it edits.
 *
 * Three functions have to agree for an edit to be safe, and each is tested
 * alone: the prefill turns a row into fields, the parse turns fields back into
 * values, and the diff says what changed. If any pair disagrees the symptom is
 * the same and it is the worst one this feature has — a reader opens a
 * deliverable, saves it, and the row comes back different from the one they
 * were looking at.
 *
 * So these go through a real database. An untouched save must write nothing at
 * all, and a one-field edit must change that field and no other.
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

function stored(values: Partial<Deliverable> = {}) {
  return createDeliverable(
    {
      projectId,
      title: values.title ?? "Wireframes",
      description: values.description ?? "Six screens.",
      estimatedMinutes: values.estimatedMinutes ?? 90,
    },
    db,
  );
}

/** The form opened on a row, with whatever the reader typed into it. */
function typed(row: Deliverable, values: Record<string, string> = {}) {
  const parsed = parseDeliverableForm({
    ...deliverableFormFields(row),
    ...values,
  });
  if (!parsed.ok) throw new Error("expected the form to be accepted");
  return parsed.value;
}

describe("a form opened on a deliverable and saved untouched", () => {
  it("asks for no change at all", async () => {
    const row = await stored();
    expect(changesDeliverable(deliverableChanges(row, typed(row)))).toBe(false);
  });

  it("asks for no change on a line with no detail and no estimate", async () => {
    const row = await stored({ description: null, estimatedMinutes: 0 });
    expect(changesDeliverable(deliverableChanges(row, typed(row)))).toBe(false);
  });

  it("leaves updatedAt alone, so the line does not claim to have changed", async () => {
    const row = await stored();
    const patch = deliverableChanges(row, typed(row));

    // What the write would do with an empty patch: nothing, by `updateDeliverable`'s
    // own rule. Asserted here because the rule is what keeps the timestamp honest.
    const after = await updateDeliverable(row.id, patch, db);
    expect(after?.updatedAt).toBe(row.updatedAt);
  });
});

describe("a one-field edit", () => {
  it("writes the new title and nothing else", async () => {
    const row = await stored();
    const patch = deliverableChanges(row, typed(row, { title: "Flows" }));

    const after = await updateDeliverable(row.id, patch, db);

    expect(after).toMatchObject({
      title: "Flows",
      description: "Six screens.",
      estimatedMinutes: 90,
      status: row.status,
      sortOrder: row.sortOrder,
    });
  });

  it("writes an estimate typed in hours as whole minutes", async () => {
    const row = await stored();
    const patch = deliverableChanges(row, typed(row, { estimate: "2.25" }));

    const after = await updateDeliverable(row.id, patch, db);

    expect(after?.estimatedMinutes).toBe(135);
  });

  it("clears a description back to NULL when the box is emptied", async () => {
    const row = await stored();
    const patch = deliverableChanges(row, typed(row, { description: "" }));

    const after = await updateDeliverable(row.id, patch, db);

    expect(after?.description).toBeNull();
  });

  it("clears an estimate back to nothing when the box is emptied", async () => {
    const row = await stored();
    const patch = deliverableChanges(row, typed(row, { estimate: "" }));

    const after = await updateDeliverable(row.id, patch, db);

    expect(after?.estimatedMinutes).toBe(0);
  });

  it("does not move the line in the list", async () => {
    const first = await stored({ title: "Discovery" });
    const second = await stored({ title: "Wireframes" });

    const patch = deliverableChanges(second, typed(second, { title: "Flows" }));
    await updateDeliverable(second.id, patch, db);

    expect((await getDeliverable(first.id, db))?.sortOrder).toBe(0);
    expect((await getDeliverable(second.id, db))?.sortOrder).toBe(1);
  });
});

describe("an edit of a line that has been saved once already", () => {
  it("round-trips, so saving twice in a row writes once", async () => {
    const row = await stored();
    const saved = await updateDeliverable(
      row.id,
      deliverableChanges(row, typed(row, { title: "Flows", estimate: "3" })),
      db,
    );
    if (saved === null) throw new Error("expected the edit to be saved");

    // The form reopens on what was written, and the reader saves it untouched.
    expect(changesDeliverable(deliverableChanges(saved, typed(saved)))).toBe(
      false,
    );
  });
});
