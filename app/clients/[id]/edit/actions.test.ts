import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_CLIENT_FORM_STATE } from "@/lib/clients/form";
import { updateClient } from "@/lib/data/clients";

import { updateClientAction } from "./actions";

/**
 * As with the create action, the collaborators are mocked: what is under test
 * here is the branching — reject, fail, vanish, redirect — and validation and
 * writing are each already covered where they live.
 */
vi.mock("@/lib/data/clients", () => ({ updateClient: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // The real `redirect` signals by throwing, and the action depends on it.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const saved = vi.mocked(updateClient);

const CLIENT_ID = "cli_existing";

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function save(values: Record<string, string>) {
  return updateClientAction(CLIENT_ID, INITIAL_CLIENT_FORM_STATE, submit(values));
}

beforeEach(() => {
  vi.clearAllMocks();
  saved.mockResolvedValue({
    id: CLIENT_ID,
    name: "Ada King",
    email: null,
    company: null,
    notes: null,
    defaultRateCents: 15000,
    archivedAt: null,
    createdAt: "2026-09-21T09:00:00.000Z",
    updatedAt: "2026-09-22T09:00:00.000Z",
  });
});

describe("updateClientAction", () => {
  it("writes the parsed patch to the bound client and redirects", async () => {
    await expect(
      save({ name: "Ada King", defaultRate: "$150" }),
    ).rejects.toThrow("NEXT_REDIRECT:/clients");

    expect(saved).toHaveBeenCalledWith(CLIENT_ID, {
      name: "Ada King",
      email: null,
      company: null,
      notes: null,
      defaultRateCents: 15000,
    });
    expect(redirect).toHaveBeenCalledWith("/clients");
  });

  it("revalidates both the list and the page that was edited", async () => {
    await expect(save({ name: "Ada King" })).rejects.toThrow("NEXT_REDIRECT");

    expect(revalidatePath).toHaveBeenCalledWith("/clients");
    expect(revalidatePath).toHaveBeenCalledWith(`/clients/${CLIENT_ID}/edit`);
  });

  it("returns field errors and writes nothing when validation fails", async () => {
    const state = await save({ name: "", email: "nope", defaultRate: "-5" });

    expect(state.errors).toEqual({
      name: "Name is required.",
      email: "Email does not look like an email address.",
      defaultRate: "Default rate cannot be negative.",
    });
    expect(state.formError).toBeNull();
    expect(saved).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("echoes the submitted fields back so the edit is not lost", async () => {
    const state = await save({
      name: "",
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Pays on time.",
      defaultRate: "150",
    });

    expect(state.fields).toEqual({
      name: "",
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Pays on time.",
      defaultRate: "150",
    });
  });

  it("reports a write failure as a form-level problem, not a field one", async () => {
    saved.mockRejectedValue(new Error("database is locked"));

    const state = await save({ name: "Ada King" });

    expect(state.formError).toBe(
      "Could not save the changes. Nothing was written — try again.",
    );
    expect(state.errors).toEqual({});
    expect(state.fields.name).toBe("Ada King");
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says so when the client disappeared between render and submit", async () => {
    saved.mockResolvedValue(null);

    const state = await save({ name: "Ada King" });

    expect(state.formError).toBe(
      "That client no longer exists. Nothing was saved.",
    );
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("edits the bound client, not one named in the submission", async () => {
    await expect(
      save({ name: "Ada King", id: "cli_somebody_else" }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(saved).toHaveBeenCalledWith(CLIENT_ID, expect.anything());
    expect(saved).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ id: expect.anything() }),
    );
  });
});
