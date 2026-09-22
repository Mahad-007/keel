import { beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "@/lib/db/testing";
import type { Database } from "@/lib/db";

import {
  archiveClient,
  createClient,
  getClient,
  listArchivedClients,
  listClients,
  unarchiveClient,
  updateClient,
} from "./clients";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

/**
 * Archive timestamps come from the wall clock, so two archives in the same
 * millisecond would tie and the ordering test would pass or fail by luck.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

describe("createClient", () => {
  it("stores the client and hands back the saved row", async () => {
    const client = await createClient(
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        notes: "Pays on time.",
        defaultRateCents: 15000,
      },
      db,
    );

    expect(client.id).toMatch(/^cli_/);
    expect(client.name).toBe("Ada Lovelace");
    expect(client.defaultRateCents).toBe(15000);
    expect(client.archivedAt).toBeNull();
    expect(await getClient(client.id, db)).toEqual(client);
  });

  it("defaults the rate to zero and leaves optional fields null", async () => {
    const client = await createClient({ name: "Solo Trader" }, db);

    expect(client.defaultRateCents).toBe(0);
    expect(client.email).toBeNull();
    expect(client.company).toBeNull();
    expect(client.notes).toBeNull();
  });

  it("trims text and treats a blank optional field as absent", async () => {
    const client = await createClient(
      { name: "  Grace Hopper  ", email: "   ", company: "  Navy " },
      db,
    );

    expect(client.name).toBe("Grace Hopper");
    expect(client.email).toBeNull();
    expect(client.company).toBe("Navy");
  });

  it("refuses a client with no name", async () => {
    await expect(createClient({ name: "   " }, db)).rejects.toThrow(/name/);
  });

  it("refuses a rate that is not whole, non-negative cents", async () => {
    await expect(
      createClient({ name: "Fractional", defaultRateCents: 100.5 }, db),
    ).rejects.toThrow(/whole cents/);
    await expect(
      createClient({ name: "Negative", defaultRateCents: -1 }, db),
    ).rejects.toThrow(/negative/);
  });

  it("gives every client a distinct id", async () => {
    const a = await createClient({ name: "One" }, db);
    const b = await createClient({ name: "Two" }, db);

    expect(a.id).not.toBe(b.id);
  });

  it("timestamps rows as ISO strings", async () => {
    const client = await createClient({ name: "Timestamped" }, db);

    expect(client.createdAt).toBe(new Date(client.createdAt).toISOString());
    expect(client.updatedAt).toBe(client.createdAt);
  });
});

describe("getClient", () => {
  it("returns null for an id that was never issued", async () => {
    expect(await getClient("cli_nope", db)).toBeNull();
  });

  it("still finds an archived client", async () => {
    const client = await createClient({ name: "Gone Quiet" }, db);
    await archiveClient(client.id, db);

    const found = await getClient(client.id, db);
    expect(found?.id).toBe(client.id);
    expect(found?.archivedAt).not.toBeNull();
  });
});

describe("listClients", () => {
  it("is empty before anything is created", async () => {
    expect(await listClients(db)).toEqual([]);
  });

  it("sorts by name without caring about case", async () => {
    await createClient({ name: "zeppelin works" }, db);
    await createClient({ name: "Anvil Co" }, db);
    await createClient({ name: "beacon ltd" }, db);

    expect((await listClients(db)).map((c) => c.name)).toEqual([
      "Anvil Co",
      "beacon ltd",
      "zeppelin works",
    ]);
  });

  it("excludes archived clients", async () => {
    const kept = await createClient({ name: "Still Here" }, db);
    const archived = await createClient({ name: "Archived" }, db);
    await archiveClient(archived.id, db);

    expect((await listClients(db)).map((c) => c.id)).toEqual([kept.id]);
  });
});

describe("updateClient", () => {
  it("changes only the fields in the patch", async () => {
    const client = await createClient(
      { name: "Before", email: "before@example.com", defaultRateCents: 10000 },
      db,
    );

    const updated = await updateClient(client.id, { name: "After" }, db);

    expect(updated?.name).toBe("After");
    expect(updated?.email).toBe("before@example.com");
    expect(updated?.defaultRateCents).toBe(10000);
    expect(updated?.createdAt).toBe(client.createdAt);
  });

  it("clears an optional field set to null or blank", async () => {
    const client = await createClient(
      { name: "Clear Me", email: "old@example.com", notes: "stale" },
      db,
    );

    const updated = await updateClient(
      client.id,
      { email: null, notes: "  " },
      db,
    );

    expect(updated?.email).toBeNull();
    expect(updated?.notes).toBeNull();
  });

  it("moves updatedAt forward", async () => {
    const client = await createClient({ name: "Touch" }, db);

    const updated = await updateClient(
      client.id,
      { defaultRateCents: 12500 },
      db,
    );

    expect(updated!.updatedAt >= client.updatedAt).toBe(true);
    expect(updated?.updatedAt).toBe(
      new Date(updated!.updatedAt).toISOString(),
    );
  });

  it("leaves the row alone when the patch is empty", async () => {
    const client = await createClient({ name: "Untouched" }, db);

    expect(await updateClient(client.id, {}, db)).toEqual(client);
  });

  it("rejects an invalid patch without writing anything", async () => {
    const client = await createClient({ name: "Valid" }, db);

    await expect(
      updateClient(client.id, { name: "" }, db),
    ).rejects.toThrow(/name/);
    await expect(
      updateClient(client.id, { defaultRateCents: 0.5 }, db),
    ).rejects.toThrow(/whole cents/);
    expect(await getClient(client.id, db)).toEqual(client);
  });

  it("returns null for an unknown client", async () => {
    expect(await updateClient("cli_nope", { name: "Ghost" }, db)).toBeNull();
    expect(await updateClient("cli_nope", {}, db)).toBeNull();
  });
});

describe("archiveClient", () => {
  it("stamps archivedAt and hides the client from the list", async () => {
    const client = await createClient({ name: "Wrapping Up" }, db);

    const archived = await archiveClient(client.id, db);

    expect(archived?.archivedAt).not.toBeNull();
    expect(archived?.archivedAt).toBe(
      new Date(archived!.archivedAt!).toISOString(),
    );
    expect(await listClients(db)).toEqual([]);
  });

  it("keeps the row so nothing referencing it dangles", async () => {
    const client = await createClient({ name: "Soft Deleted" }, db);
    await archiveClient(client.id, db);

    const found = await getClient(client.id, db);
    expect(found?.name).toBe("Soft Deleted");
  });

  it("is idempotent and keeps the first archive time", async () => {
    const client = await createClient({ name: "Twice" }, db);

    const first = await archiveClient(client.id, db);
    const second = await archiveClient(client.id, db);

    expect(second?.archivedAt).toBe(first?.archivedAt);
  });

  it("returns null for an unknown client", async () => {
    expect(await archiveClient("cli_nope", db)).toBeNull();
  });
});

describe("unarchiveClient", () => {
  it("clears archivedAt and puts the client back on the list", async () => {
    const client = await createClient({ name: "Back In Touch" }, db);
    await archiveClient(client.id, db);

    const restored = await unarchiveClient(client.id, db);

    expect(restored?.archivedAt).toBeNull();
    expect((await listClients(db)).map((c) => c.id)).toEqual([client.id]);
  });

  it("restores the client under its original id and details", async () => {
    const client = await createClient(
      { name: "Same Client", email: "same@example.com", defaultRateCents: 9900 },
      db,
    );
    await archiveClient(client.id, db);

    const restored = await unarchiveClient(client.id, db);

    expect(restored?.id).toBe(client.id);
    expect(restored?.email).toBe("same@example.com");
    expect(restored?.defaultRateCents).toBe(9900);
    expect(restored?.createdAt).toBe(client.createdAt);
  });

  it("leaves a client that was never archived untouched", async () => {
    const client = await createClient({ name: "Never Left" }, db);

    expect(await unarchiveClient(client.id, db)).toEqual(client);
  });

  it("returns null for an unknown client", async () => {
    expect(await unarchiveClient("cli_nope", db)).toBeNull();
  });

  it("can be archived again after being restored", async () => {
    const client = await createClient({ name: "Round Trip" }, db);

    await archiveClient(client.id, db);
    await unarchiveClient(client.id, db);
    const archived = await archiveClient(client.id, db);

    expect(archived?.archivedAt).not.toBeNull();
    expect(await listClients(db)).toEqual([]);
  });
});

describe("listArchivedClients", () => {
  it("is empty when nothing has been archived", async () => {
    await createClient({ name: "Active" }, db);

    expect(await listArchivedClients(db)).toEqual([]);
  });

  it("holds exactly the clients the active list does not", async () => {
    const active = await createClient({ name: "Active" }, db);
    const archived = await createClient({ name: "Archived" }, db);
    await archiveClient(archived.id, db);

    expect((await listArchivedClients(db)).map((c) => c.id)).toEqual([
      archived.id,
    ]);
    expect((await listClients(db)).map((c) => c.id)).toEqual([active.id]);
  });

  it("puts the most recently archived first", async () => {
    const first = await createClient({ name: "First Out" }, db);
    const second = await createClient({ name: "Second Out" }, db);

    await archiveClient(first.id, db);
    await tick();
    await archiveClient(second.id, db);

    expect((await listArchivedClients(db)).map((c) => c.name)).toEqual([
      "Second Out",
      "First Out",
    ]);
  });

  it("drops a client again once it is restored", async () => {
    const client = await createClient({ name: "Restored" }, db);
    await archiveClient(client.id, db);
    await unarchiveClient(client.id, db);

    expect(await listArchivedClients(db)).toEqual([]);
  });
});
