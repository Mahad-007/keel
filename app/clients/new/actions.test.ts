import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_CLIENT_FORM_STATE } from "@/lib/clients/form";
import { createClient } from "@/lib/data/clients";

import { createClientAction } from "./actions";

/**
 * The action is tested against mocked collaborators rather than a real
 * database: its own job is the branching — reject, fail, redirect — and the
 * validation and the writing are each already tested where they live.
 */
vi.mock("@/lib/data/clients", () => ({ createClient: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // The real `redirect` signals by throwing, and the action depends on it.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const created = vi.mocked(createClient);

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  created.mockResolvedValue({
    id: "cli_test",
    name: "Ada Lovelace",
    email: null,
    company: null,
    notes: null,
    defaultRateCents: 15000,
    archivedAt: null,
    createdAt: "2026-09-21T09:00:00.000Z",
    updatedAt: "2026-09-21T09:00:00.000Z",
  });
});

describe("createClientAction", () => {
  it("writes the parsed client and redirects to the list", async () => {
    const form = submit({ name: "Ada Lovelace", defaultRate: "$150" });

    await expect(
      createClientAction(INITIAL_CLIENT_FORM_STATE, form),
    ).rejects.toThrow("NEXT_REDIRECT:/clients");

    expect(created).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: null,
      company: null,
      notes: null,
      defaultRateCents: 15000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
    expect(redirect).toHaveBeenCalledWith("/clients");
  });

  it("returns field errors and writes nothing when validation fails", async () => {
    const form = submit({ name: "", email: "nope", defaultRate: "-5" });

    const state = await createClientAction(INITIAL_CLIENT_FORM_STATE, form);

    expect(state.errors).toEqual({
      name: "Name is required.",
      email: "Email does not look like an email address.",
      defaultRate: "Default rate cannot be negative.",
    });
    expect(state.formError).toBeNull();
    expect(created).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("echoes the submitted fields back so the form is not cleared", async () => {
    const form = submit({
      name: "",
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Pays on time.",
      defaultRate: "150",
    });

    const state = await createClientAction(INITIAL_CLIENT_FORM_STATE, form);

    expect(state.fields).toEqual({
      name: "",
      email: "ada@example.com",
      company: "Analytical Engines",
      notes: "Pays on time.",
      defaultRate: "150",
    });
  });

  it("reports a write failure as a form-level problem, not a field one", async () => {
    created.mockRejectedValue(new Error("database is locked"));
    const form = submit({ name: "Ada Lovelace" });

    const state = await createClientAction(INITIAL_CLIENT_FORM_STATE, form);

    expect(state.formError).toBe(
      "Could not save the client. Nothing was written — try again.",
    );
    expect(state.errors).toEqual({});
    expect(state.fields.name).toBe("Ada Lovelace");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not revalidate or redirect when the write failed", async () => {
    created.mockRejectedValue(new Error("database is locked"));

    await createClientAction(INITIAL_CLIENT_FORM_STATE, submit({ name: "Ada" }));

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("ignores fields the form does not own", async () => {
    const form = submit({ name: "Ada Lovelace", id: "cli_smuggled" });

    await expect(
      createClientAction(INITIAL_CLIENT_FORM_STATE, form),
    ).rejects.toThrow("NEXT_REDIRECT:/clients");

    expect(created).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: expect.anything() }),
    );
  });
});
