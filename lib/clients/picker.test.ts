import { beforeEach, describe, expect, it } from "vitest";

import { archiveClient, createClient } from "@/lib/data/clients";
import type { Database } from "@/lib/db";
import { createTestDb } from "@/lib/db/testing";

import { projectClientOptions } from "./picker";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("projectClientOptions", () => {
  it("offers every active client, in the client list's order", async () => {
    await createClient({ name: "Grace Hopper" }, db);
    await createClient({ name: "Ada Lovelace" }, db);

    expect(await projectClientOptions(null, db)).toEqual([
      { id: expect.stringMatching(/^cli_/), label: "Ada Lovelace", archived: false },
      { id: expect.stringMatching(/^cli_/), label: "Grace Hopper", archived: false },
    ]);
  });

  it("offers nothing when there are no clients to file a project under", async () => {
    expect(await projectClientOptions(null, db)).toEqual([]);
  });

  it("leaves an archived client out of a new project's picker", async () => {
    const gone = await createClient({ name: "Grace Hopper" }, db);
    await archiveClient(gone.id, db);

    expect(await projectClientOptions(null, db)).toEqual([]);
  });

  it("keeps an archived client for the project that is already on them", async () => {
    const gone = await createClient({ name: "Grace Hopper" }, db);
    await archiveClient(gone.id, db);
    await createClient({ name: "Ada Lovelace" }, db);

    const options = await projectClientOptions(gone.id, db);

    expect(options.map((option) => option.label)).toEqual([
      "Ada Lovelace",
      "Grace Hopper (archived)",
    ]);
  });

  it("does not offer an active client twice for their own project", async () => {
    const ada = await createClient({ name: "Ada Lovelace" }, db);

    expect(await projectClientOptions(ada.id, db)).toEqual([
      { id: ada.id, label: "Ada Lovelace", archived: false },
    ]);
  });

  it("offers the active clients when the current one has been deleted outright", async () => {
    const ada = await createClient({ name: "Ada Lovelace" }, db);

    expect(await projectClientOptions("cli_gone", db)).toEqual([
      { id: ada.id, label: "Ada Lovelace", archived: false },
    ]);
  });
});
