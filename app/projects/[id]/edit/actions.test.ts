import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectClientOptions } from "@/lib/clients/picker";
import { getProject, updateProject } from "@/lib/data/projects";
import type { Project } from "@/lib/db/schema";
import { projectFormStateFor } from "@/lib/projects/form";

import { updateProjectAction } from "./actions";

/**
 * Mocked collaborators, like the create action: the branching is this file's
 * job, and the validation, the picker, and the write are tested where they
 * live.
 */
vi.mock("@/lib/data/projects", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("@/lib/clients/picker", () => ({ projectClientOptions: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const read = vi.mocked(getProject);
const saved = vi.mocked(updateProject);
const offered = vi.mocked(projectClientOptions);

const STORED: Project = {
  id: "prj_engine",
  clientId: "cli_ada",
  name: "Engine rewrite",
  status: "active",
  contractValueCents: 1_200_000,
  rateCents: 18000,
  startedAt: "2026-09-01T09:00:00.000Z",
  closedAt: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
};

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

/** What the form holds on load, so a test only names what it changed. */
function edit(changes: Record<string, string>) {
  const fields = projectFormStateFor(STORED).fields;
  return updateProjectAction(
    STORED.id,
    projectFormStateFor(STORED),
    submit({ ...fields, ...changes }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(STORED);
  saved.mockResolvedValue(STORED);
  offered.mockResolvedValue([
    { id: "cli_ada", label: "Ada Lovelace", archived: false },
    { id: "cli_grace", label: "Grace Hopper", archived: false },
  ]);
});

describe("updateProjectAction", () => {
  it("saves the changed fields and goes back to the project", async () => {
    await expect(edit({ contractValue: "15000" })).rejects.toThrow(
      "NEXT_REDIRECT:/projects/prj_engine",
    );

    expect(saved).toHaveBeenCalledWith("prj_engine", {
      clientId: "cli_ada",
      name: "Engine rewrite",
      contractValueCents: 1_500_000,
      rateCents: 18000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/projects/prj_engine");
  });

  it("offers the project's own client, whatever the state of the client book", async () => {
    await expect(edit({})).rejects.toThrow("NEXT_REDIRECT:");
    expect(offered).toHaveBeenCalledWith("cli_ada");
  });

  it("clears the rate override when the field is emptied", async () => {
    await expect(edit({ rateOverride: "" })).rejects.toThrow("NEXT_REDIRECT:");

    expect(saved).toHaveBeenCalledWith(
      "prj_engine",
      expect.objectContaining({ rateCents: null }),
    );
  });

  it("does not touch the project's status", async () => {
    await expect(edit({})).rejects.toThrow("NEXT_REDIRECT:");

    expect(saved.mock.calls[0][1]).not.toHaveProperty("status");
  });
});

describe("an edit that cannot be saved", () => {
  it("returns field errors and writes nothing", async () => {
    const state = await edit({ name: "", contractValue: "-1" });

    expect(state.errors).toEqual({
      name: "Name is required.",
      contractValue: "Contract value cannot be negative.",
    });
    expect(state.fields.contractValue).toBe("-1");
    expect(saved).not.toHaveBeenCalled();
  });

  it("refuses to move the project to a client the picker did not offer", async () => {
    const state = await edit({ client: "cli_nobody" });

    expect(state.errors.client).toBe(
      "That client is not one you can pick. Choose another.",
    );
    expect(saved).not.toHaveBeenCalled();
  });

  it("says so when the project was deleted before the form came back", async () => {
    read.mockResolvedValue(null);

    const state = await edit({ name: "Engine rewrite II" });

    expect(state.formError).toBe(
      "That project no longer exists. Nothing was saved.",
    );
    expect(state.fields.name).toBe("Engine rewrite II");
    expect(saved).not.toHaveBeenCalled();
  });

  it("says the same thing when it disappears between the read and the write", async () => {
    saved.mockResolvedValue(null);

    const state = await edit({});

    expect(state.formError).toBe(
      "That project no longer exists. Nothing was saved.",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("reports a failed write instead of losing the changes", async () => {
    saved.mockRejectedValue(new Error("database is locked"));

    const state = await edit({ contractValue: "15000" });

    expect(state.formError).toBe(
      "Could not save the changes. Nothing was written — try again.",
    );
    expect(state.fields.contractValue).toBe("15000");
    expect(redirect).not.toHaveBeenCalled();
  });
});
