import { beforeEach, describe, expect, it } from "vitest";

import { createClient, listClients } from "@/lib/data/clients";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { EMPTY_CLIENT_FIELDS, parseClientForm, type ClientFormFields } from "./form";

/**
 * The seam between the form and the data layer. Both sides validate — the
 * form to produce a message, `createClient` to protect the table — and they
 * can drift apart: a limit relaxed here and not there turns a form the user
 * filled in correctly into a thrown driver error.
 *
 * These tests write what the form produces to a real database and read it
 * back, so the drift fails here rather than in production.
 */

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

function save(fields: Partial<ClientFormFields>) {
  const parsed = parseClientForm({
    ...EMPTY_CLIENT_FIELDS,
    name: "Ada Lovelace",
    ...fields,
  });
  if (!parsed.ok) throw new Error(`expected valid fields: ${JSON.stringify(parsed.errors)}`);
  return createClient(parsed.value, db);
}

describe("a form the validator accepts", () => {
  it("is written as a client and appears on the list", async () => {
    const saved = await save({
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Pays on time.",
      defaultRate: "$150.00",
    });

    expect(saved.id).toMatch(/^cli_/);
    expect(saved.defaultRateCents).toBe(15000);
    expect(await listClients(db)).toEqual([saved]);
  });

  it("stores skipped fields as NULL rather than empty strings", async () => {
    const saved = await save({});

    expect(saved.email).toBeNull();
    expect(saved.company).toBeNull();
    expect(saved.notes).toBeNull();
    expect(saved.defaultRateCents).toBe(0);
  });

  it("stores the rate as an integer number of cents", async () => {
    const saved = await save({ defaultRate: "137.45" });

    expect(saved.defaultRateCents).toBe(13745);
    expect(Number.isInteger(saved.defaultRateCents)).toBe(true);
  });

  it("is accepted at every length limit the form allows", async () => {
    const saved = await save({
      name: "a".repeat(120),
      company: "b".repeat(120),
      notes: "c".repeat(2000),
      defaultRate: "10000",
    });

    expect(saved.name).toHaveLength(120);
    expect(saved.company).toHaveLength(120);
    expect(saved.notes).toHaveLength(2000);
    expect(saved.defaultRateCents).toBe(1_000_000);
  });

  it("keeps two clients with the same name apart", async () => {
    const first = await save({});
    const second = await save({});

    expect(second.id).not.toBe(first.id);
    expect(await listClients(db)).toHaveLength(2);
  });
});
