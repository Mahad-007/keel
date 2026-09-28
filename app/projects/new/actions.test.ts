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
