import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createDeliverable, listDeliverables } from "@/lib/data/deliverables";
import { createProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { MAX_ESTIMATE_MINUTES } from "@/lib/forms/estimate";

import {
  DELIVERABLE_FIELD_LIMITS,
  EMPTY_DELIVERABLE_FIELDS,
  parseDeliverableForm,
  type DeliverableFormFields,
} from "./form";

/**
 * The seam between the deliverable form and the data layer. Both sides
 * validate — the form to produce a message, `createDeliverable` to protect the
 * table — and they can drift apart: an estimate the form accepts and
 * `wholeMinutes` throws on turns a correctly filled form into a driver error.
 *
 * These tests write what the form produces to a real database and read it
 * back, so the drift fails here rather than in front of a client.
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

function parsed(fields: Partial<DeliverableFormFields>) {
  const result = parseDeliverableForm({
    ...EMPTY_DELIVERABLE_FIELDS,
    title: "Wireframes",
    ...fields,
  });
  if (!result.ok) {
    throw new Error(`expected valid fields: ${JSON.stringify(result.errors)}`);
  }
  return result.value;
}

function save(fields: Partial<DeliverableFormFields>) {
  return createDeliverable({ projectId, ...parsed(fields) }, db);
}

describe("a deliverable form the validator accepts", () => {
  it("is written as pending scope at the end of the project's list", async () => {
    const first = await save({ title: "Wireframes", estimate: "1.5" });
    const second = await save({ title: "Build" });

    expect(first.id).toMatch(/^dlv_/);
    expect(first.projectId).toBe(projectId);
    expect(first.estimatedMinutes).toBe(90);
    expect(first.status).toBe("pending");
    expect([first.sortOrder, second.sortOrder]).toEqual([0, 1]);
  });

  it("stores a blank description as NULL rather than an empty string", async () => {
    const deliverable = await save({ description: "   " });
    expect(deliverable.description).toBeNull();
  });

  it("reads back in the order the lines were added", async () => {
    await save({ title: "Wireframes" });
    await save({ title: "Build" });
    await save({ title: "Launch" });

    const titles = (await listDeliverables(projectId, db)).map((d) => d.title);
    expect(titles).toEqual(["Wireframes", "Build", "Launch"]);
  });
});

describe("the limits the two halves have to agree on", () => {
  it("accepts a title of exactly the length the form allows", async () => {
    const title = "x".repeat(DELIVERABLE_FIELD_LIMITS.title);
    await expect(save({ title })).resolves.toMatchObject({ title });
  });

  it("accepts a description of exactly the length the form allows", async () => {
    const description = "x".repeat(DELIVERABLE_FIELD_LIMITS.description);
    await expect(save({ description })).resolves.toMatchObject({
      description,
    });
  });

  it("accepts the largest estimate the form allows", async () => {
    await expect(save({ estimate: "1000" })).resolves.toMatchObject({
      estimatedMinutes: MAX_ESTIMATE_MINUTES,
    });
  });

  it("accepts an estimate the form turns into zero", async () => {
    await expect(save({ estimate: "" })).resolves.toMatchObject({
      estimatedMinutes: 0,
    });
  });
});
