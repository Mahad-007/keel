import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectClientOptions } from "@/lib/clients/picker";
import { createProject } from "@/lib/data/projects";
import { INITIAL_PROJECT_FORM_STATE } from "@/lib/projects/form";

import { createProjectAction } from "./actions";

/**
 * The action is tested against mocked collaborators rather than a real
 * database: its own job is the branching — reject, fail, redirect — and the
 * validation, the picker, and the writing are each already tested where they
 * live.
 */
vi.mock("@/lib/data/projects", () => ({ createProject: vi.fn() }));

vi.mock("@/lib/clients/picker", () => ({ projectClientOptions: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // The real `redirect` signals by throwing, and the action depends on it.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const created = vi.mocked(createProject);
const offered = vi.mocked(projectClientOptions);

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function save(values: Record<string, string>) {
  return createProjectAction(INITIAL_PROJECT_FORM_STATE, submit(values));
}

beforeEach(() => {
  vi.clearAllMocks();
  offered.mockResolvedValue([
    { id: "cli_ada", label: "Ada Lovelace", archived: false },
  ]);
  created.mockResolvedValue({
    id: "prj_engine",
    clientId: "cli_ada",
    name: "Engine rewrite",
    status: "draft",
    contractValueCents: 1_200_000,
    rateCents: null,
    startedAt: null,
    closedAt: null,
    createdAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-09-28T09:00:00.000Z",
  });
});

describe("createProjectAction", () => {
  it("writes the parsed project and opens it", async () => {
    await expect(
      save({ client: "cli_ada", name: "Engine rewrite", contractValue: "12000" }),
    ).rejects.toThrow("NEXT_REDIRECT:/projects/prj_engine");

    expect(created).toHaveBeenCalledWith({
      clientId: "cli_ada",
      name: "Engine rewrite",
      contractValueCents: 1_200_000,
      rateCents: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/projects");
    expect(redirect).toHaveBeenCalledWith("/projects/prj_engine");
  });
});

describe("a project form that is rejected", () => {
  it("returns field errors, keeps what was typed, and writes nothing", async () => {
    const state = await save({ client: "", name: "", contractValue: "lots" });

    expect(state.errors).toEqual({
      client: "Client is required.",
      name: "Name is required.",
      contractValue: "Contract value must be an amount, like 150 or 150.00.",
    });
    expect(state.fields).toEqual({
      client: "",
      name: "",
      contractValue: "lots",
      rateOverride: "",
    });
    expect(state.formError).toBeNull();
    expect(created).not.toHaveBeenCalled();
  });

  it("refuses a client the picker never offered", async () => {
    const state = await save({ client: "cli_grace", name: "Engine rewrite" });

    expect(state.errors.client).toBe(
      "That client is not one you can pick. Choose another.",
    );
    expect(created).not.toHaveBeenCalled();
  });

  /** Ada archived while the form sat open, with somebody else still on the books. */
  function onlyGraceLeft() {
    offered.mockResolvedValue([
      { id: "cli_grace", label: "Grace Hopper", archived: false },
    ]);
  }

  it("refuses a client who was archived while the form sat open", async () => {
    onlyGraceLeft();

    const state = await save({ client: "cli_ada", name: "Engine rewrite" });

    expect(state.errors.client).toBe(
      "That client is not one you can pick. Choose another.",
    );
    expect(created).not.toHaveBeenCalled();
  });

  it("re-reads the form's own page, so the refused client leaves the picker", async () => {
    onlyGraceLeft();

    await save({ client: "cli_ada", name: "Engine rewrite" });

    expect(revalidatePath).toHaveBeenCalledWith("/projects/new");
  });

  it("re-reads the page for a skipped pick too, which may be why it was skipped", async () => {
    // Somebody else having been archived is a reason the reader could not find
    // the client they were looking for, and they cannot tell until the page has
    // been read again.
    onlyGraceLeft();

    const state = await save({ client: "", name: "Engine rewrite" });

    expect(state.errors.client).toBe("Client is required.");
    expect(revalidatePath).toHaveBeenCalledWith("/projects/new");
  });

  it("keeps the whole form when the last client has gone, and says so", async () => {
    // Re-reading the page here would swap the form for its "no clients" panel
    // and lose the name and figures along with it.
    offered.mockResolvedValue([]);

    const state = await save({
      client: "cli_ada",
      name: "Engine rewrite",
      contractValue: "12000",
    });

    expect(state.errors.client).toBe(
      "There are no clients left to file a project under. Restore one from the" +
        " archived list, or add a new client, and this form will keep what you" +
        " typed.",
    );
    expect(state.fields.name).toBe("Engine rewrite");
    expect(state.fields.contractValue).toBe("12000");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("leaves the page alone when the picker was never the problem", async () => {
    const state = await save({ client: "cli_ada", name: "" });

    expect(state.errors.name).toBe("Name is required.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("a project that cannot be written", () => {
  it("says nothing was saved and keeps the form filled in", async () => {
    created.mockRejectedValue(new Error("database is locked"));
    const values = {
      client: "cli_ada",
      name: "Engine rewrite",
      contractValue: "12000",
      rateOverride: "180",
    };

    const state = await save(values);

    expect(state.formError).toBe(
      "Could not save the project. Nothing was written — try again.",
    );
    expect(state.errors).toEqual({});
    expect(state.fields).toEqual(values);
    expect(redirect).not.toHaveBeenCalled();
  });
});
