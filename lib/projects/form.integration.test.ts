import { beforeEach, describe, expect, it } from "vitest";

import { createClient } from "@/lib/data/clients";
import { createProject, getProject, updateProject } from "@/lib/data/projects";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";
import { MAX_AMOUNT_CENTS } from "@/lib/forms/amount";
import { MAX_RATE_CENTS } from "@/lib/forms/rate";

import {
  EMPTY_PROJECT_FIELDS,
  parseProjectForm,
  projectFormFields,
  type ProjectFormFields,
} from "./form";

/**
 * The seam between the project form and the data layer. Both sides validate —
 * the form to produce a message, `createProject` to protect the table — and
 * they can drift apart: a ceiling relaxed here and not there turns a form the
 * user filled in correctly into a thrown driver error.
 *
 * These tests write what the form produces to a real database and read it back,
 * so the drift fails here rather than in production.
 */

let db: Database;
let clientId: string;

beforeEach(async () => {
  db = await createTestDb();
  const client = await createClient({ name: "Ada Lovelace" }, db);
  clientId = client.id;
});

function parsed(
  fields: Partial<ProjectFormFields>,
  offered: string[] = [clientId],
) {
  const result = parseProjectForm(
    { ...EMPTY_PROJECT_FIELDS, client: clientId, name: "Engine rewrite", ...fields },
    offered,
  );
  if (!result.ok) {
    throw new Error(`expected valid fields: ${JSON.stringify(result.errors)}`);
  }
  return result.value;
}

function save(fields: Partial<ProjectFormFields>) {
  return createProject(parsed(fields), db);
}

describe("a project form the validator accepts", () => {
  it("is written as a draft project under the picked client", async () => {
    const project = await save({ contractValue: "12000", rateOverride: "180" });

    expect(project.id).toMatch(/^prj_/);
    expect(project.clientId).toBe(clientId);
    expect(project.status).toBe("draft");
    expect(project.contractValueCents).toBe(1_200_000);
    expect(project.rateCents).toBe(18000);
  });

  it("stores a blank override as NULL, so the client's rate applies", async () => {
    const project = await save({ rateOverride: "" });
    expect(project.rateCents).toBeNull();
  });

  it("stores an override of zero as zero, which means something else", async () => {
    const project = await save({ rateOverride: "0" });
    expect(project.rateCents).toBe(0);
  });

  it("stores an unagreed contract value as zero", async () => {
    const project = await save({ contractValue: "" });
    expect(project.contractValueCents).toBe(0);
  });

  it("writes the largest amounts the form accepts", async () => {
    const project = await save({
      contractValue: "10000000",
      rateOverride: "10000",
    });

    expect(project.contractValueCents).toBe(MAX_AMOUNT_CENTS);
    expect(project.rateCents).toBe(MAX_RATE_CENTS);
  });
});

describe("a stored project edited through the form", () => {
  it("writes back exactly what it was given, on a submission nobody touched", async () => {
    const project = await save({ contractValue: "12000", rateOverride: "180" });

    const saved = await updateProject(
      project.id,
      parsed(projectFormFields(project)),
      db,
    );

    // Everything but `updatedAt`: a save that reaches the table is a save, and
    // the row it wrote has to be the row that was already there.
    expect(saved).toEqual({ ...project, updatedAt: saved?.updatedAt });
  });

  it("clears the override back to the client's rate when emptied", async () => {
    const project = await save({ rateOverride: "180" });

    await updateProject(
      project.id,
      parsed({ ...projectFormFields(project), rateOverride: "" }),
      db,
    );

    expect((await getProject(project.id, db))?.rateCents).toBeNull();
  });

  it("moves the project to another client without touching its status", async () => {
    const project = await save({});
    const other = await createClient({ name: "Grace Hopper" }, db);

    const saved = await updateProject(
      project.id,
      parsed({ ...projectFormFields(project), client: other.id }, [
        clientId,
        other.id,
      ]),
      db,
    );

    expect(saved?.clientId).toBe(other.id);
    expect(saved?.status).toBe(project.status);
  });
});
