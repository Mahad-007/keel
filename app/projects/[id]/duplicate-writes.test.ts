import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { duplicateProject } from "@/lib/data/projects";
import {
  DUPLICATE_PROBLEMS,
  initialDuplicateState,
} from "@/lib/projects/duplicate-form";
import { PROJECTS_PATH } from "@/lib/projects/query";

import { writeDuplicatedProject } from "./duplicate-writes";

/**
 * Mocked collaborators rather than a database: the write's own job is the
 * branching — reject, refuse, redirect — and the validation and the copying
 * are each already tested where they live.
 */
vi.mock("@/lib/data/projects", () => ({ duplicateProject: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // The real `redirect` signals by throwing, and the write depends on it.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const copied = vi.mocked(duplicateProject);

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function duplicate(values: Record<string, string>) {
  return writeDuplicatedProject(
    "prj_harbour",
    initialDuplicateState("Harbour Co — site rebuild"),
    submit(values),
  );
}

const COPY = {
  ok: true as const,
  project: {
    id: "prj_copy",
    clientId: "cli_harbour",
    name: "Phase two",
    status: "draft" as const,
    contractValueCents: 1_200_000,
    rateCents: 9_500,
    startedAt: null,
    closedAt: null,
    createdAt: "2026-10-10T09:00:00.000Z",
    updatedAt: "2026-10-10T09:00:00.000Z",
  },
  deliverables: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  copied.mockResolvedValue(COPY);
});

describe("writeDuplicatedProject", () => {
  it("copies the project this page is about, under the submitted name", async () => {
    await expect(duplicate({ name: "Phase two" })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(copied).toHaveBeenCalledWith("prj_harbour", { name: "Phase two" });
  });

  it("takes the reader to the copy rather than back to the source", async () => {
    await expect(duplicate({ name: "Phase two" })).rejects.toThrow();

    expect(redirect).toHaveBeenCalledWith("/projects/prj_copy");
  });

  it("revalidates the project list, which has a new row on it", async () => {
    await expect(duplicate({ name: "Phase two" })).rejects.toThrow();

    expect(revalidatePath).toHaveBeenCalledWith(PROJECTS_PATH);
  });

  it("leaves the source project's page alone, nothing having changed", async () => {
    await expect(duplicate({ name: "Phase two" })).rejects.toThrow();

    expect(revalidatePath).not.toHaveBeenCalledWith("/projects/prj_harbour");
  });
});

describe("writeDuplicatedProject on a submission it cannot use", () => {
  it("rejects a copy with no name and writes nothing", async () => {
    const state = await duplicate({ name: "  " });

    expect(state.errors.name).toBe("Name is required.");
    expect(copied).not.toHaveBeenCalled();
  });

  it("keeps what was typed when the name is too long", async () => {
    const name = "x".repeat(200);

    const state = await duplicate({ name });

    expect(state.fields.name).toBe(name);
    expect(state.errors.name).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("writeDuplicatedProject when the copy is refused", () => {
  it("says the project is gone", async () => {
    copied.mockResolvedValue({ ok: false, reason: "no-such-project" });

    const state = await duplicate({ name: "Phase two" });

    expect(state.formError).toBe(DUPLICATE_PROBLEMS.missingProject);
  });

  it("says which scope list needs fixing on a negative estimate", async () => {
    copied.mockResolvedValue({ ok: false, reason: "negative-estimate" });

    const state = await duplicate({ name: "Phase two" });

    expect(state.formError).toBe(DUPLICATE_PROBLEMS.negativeEstimate);
  });

  it("says which scope list needs fixing on a line the columns refuse", async () => {
    copied.mockResolvedValue({ ok: false, reason: "unusable-scope" });

    const state = await duplicate({ name: "Phase two" });

    expect(state.formError).toBe(DUPLICATE_PROBLEMS.unusableScope);
  });

  it("keeps the name that was typed through a refusal", async () => {
    copied.mockResolvedValue({ ok: false, reason: "no-such-project" });

    const state = await duplicate({ name: "Phase two" });

    expect(state.fields.name).toBe("Phase two");
    expect(state.errors).toEqual({});
  });

  it("does not navigate away from a refused copy", async () => {
    copied.mockResolvedValue({ ok: false, reason: "negative-estimate" });

    await duplicate({ name: "Phase two" });

    expect(redirect).not.toHaveBeenCalled();
  });

  it("turns a thrown driver error into a sentence, not a crash", async () => {
    copied.mockRejectedValue(new Error("database is locked"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await duplicate({ name: "Phase two" });

    expect(state.formError).toBe(DUPLICATE_PROBLEMS.failed);
    expect(state.fields.name).toBe("Phase two");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
