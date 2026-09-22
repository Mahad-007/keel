import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveClient } from "@/lib/data/clients";
import type { Client } from "@/lib/db/schema";

import { archiveClientAction } from "./actions";

vi.mock("@/lib/data/clients", () => ({ archiveClient: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  // Both of these signal by throwing, and the actions rely on it.
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const CLIENT_ID = "cli_existing";

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: CLIENT_ID,
    name: "Ada Lovelace",
    email: null,
    company: null,
    notes: null,
    defaultRateCents: 0,
    archivedAt: null,
    createdAt: "2026-09-21T09:00:00.000Z",
    updatedAt: "2026-09-21T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("archiveClientAction", () => {
  it("archives the bound client and returns to the list", async () => {
    vi.mocked(archiveClient).mockResolvedValue(
      client({ archivedAt: "2026-09-22T09:00:00.000Z" }),
    );

    await expect(archiveClientAction(CLIENT_ID)).rejects.toThrow(
      "NEXT_REDIRECT:/clients",
    );

    expect(archiveClient).toHaveBeenCalledWith(CLIENT_ID);
  });

  it("revalidates both lists the client moved between", async () => {
    vi.mocked(archiveClient).mockResolvedValue(client());

    await expect(archiveClientAction(CLIENT_ID)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(revalidatePath).toHaveBeenCalledWith("/clients");
    expect(revalidatePath).toHaveBeenCalledWith("/clients/archived");
  });

  it("is a not-found rather than a silent success for an unknown client", async () => {
    vi.mocked(archiveClient).mockResolvedValue(null);

    await expect(archiveClientAction("cli_nope")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a write failure surface instead of reporting success", async () => {
    vi.mocked(archiveClient).mockRejectedValue(new Error("database is locked"));

    await expect(archiveClientAction(CLIENT_ID)).rejects.toThrow(
      "database is locked",
    );

    expect(redirect).not.toHaveBeenCalled();
  });
});
