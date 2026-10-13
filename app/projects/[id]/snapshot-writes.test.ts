import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureScopeSnapshot } from "@/lib/data/scope-snapshots";
import { projectPath } from "@/lib/projects/detail";
import {
  INITIAL_TAKE_SNAPSHOT_STATE,
  SNAPSHOT_LABEL_LIMIT,
  SNAPSHOT_PROBLEMS,
} from "@/lib/snapshots/form";

import { writeScopeSnapshot } from "./snapshot-writes";

/**
 * Mocked collaborators rather than a database: this function's own job is the
 * branching — reject, refuse, record — and the validation and the capture are
 * each already tested where they live.
 */
vi.mock("@/lib/data/scope-snapshots", () => ({
  captureScopeSnapshot: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const captured = vi.mocked(captureScopeSnapshot);

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function press(values: Record<string, string> = {}) {
  return writeScopeSnapshot(
    "prj_engine",
    INITIAL_TAKE_SNAPSHOT_STATE,
    submit(values),
  );
}

const RECORDED = {
  ok: true as const,
  snapshot: {
    id: "snp_1",
    projectId: "prj_engine",
    label: "Signed proposal",
    contractValueCents: 500_000,
    capturedAt: "2026-10-13T09:36:00.000Z",
  },
  lineCount: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  captured.mockResolvedValue(RECORDED);
});

describe("writeScopeSnapshot", () => {
  it("records the snapshot and says what went into it", async () => {
    const state = await press({ label: "Signed proposal" });

    expect(captured).toHaveBeenCalledWith("prj_engine", {
      label: "Signed proposal",
    });
    expect(state.taken).toEqual({
      id: "snp_1",
      label: "Signed proposal",
      lineCount: 4,
    });
  });

  it("records a snapshot nobody labelled", async () => {
    captured.mockResolvedValue({ ...RECORDED, snapshot: { ...RECORDED.snapshot, label: null } });

    const state = await press({ label: "" });

    expect(captured).toHaveBeenCalledWith("prj_engine", { label: null });
    expect(state.taken?.label).toBeNull();
  });

  it("re-renders the page, which is where the picker lives", async () => {
    await press();

    expect(revalidatePath).toHaveBeenCalledWith(projectPath("prj_engine"));
  });

  it("reports the label as stored rather than as submitted", async () => {
    captured.mockResolvedValue({ ...RECORDED, snapshot: { ...RECORDED.snapshot, label: null } });

    // A label of only spaces is stored as no label, and the sentence has to
    // say what is in the column.
    const state = await press({ label: "   " });

    expect(state.taken?.label).toBeNull();
  });

  it("refuses a label past the limit without touching the project", async () => {
    const state = await press({ label: "x".repeat(SNAPSHOT_LABEL_LIMIT + 1) });

    expect(captured).not.toHaveBeenCalled();
    expect(state.errors.label).toMatch(/80 characters or fewer/);
    expect(state.taken).toBeNull();
  });

  it("gives the label back when the submission is refused", async () => {
    const label = "x".repeat(SNAPSHOT_LABEL_LIMIT + 1);

    expect((await press({ label })).fields.label).toBe(label);
  });

  it("explains a project that has nothing agreed on it", async () => {
    captured.mockResolvedValue({ ok: false, reason: "empty-scope" });

    const state = await press();

    expect(state.formError).toBe(SNAPSHOT_PROBLEMS.emptyScope);
    expect(state.taken).toBeNull();
  });

  it("explains a project that has since been deleted", async () => {
    captured.mockResolvedValue({ ok: false, reason: "no-such-project" });

    expect((await press()).formError).toBe(SNAPSHOT_PROBLEMS.missingProject);
  });

  it("points at the deliverable a snapshot cannot record", async () => {
    captured.mockResolvedValue({ ok: false, reason: "unrecordable-scope" });

    expect((await press()).formError).toBe(
      SNAPSHOT_PROBLEMS.unrecordableScope,
    );
  });

  it("points at the contract value a snapshot cannot record", async () => {
    captured.mockResolvedValue({ ok: false, reason: "unrecordable-value" });

    expect((await press()).formError).toBe(
      SNAPSHOT_PROBLEMS.unrecordableValue,
    );
  });

  it("says nothing was written when the capture throws", async () => {
    captured.mockRejectedValue(new Error("database is locked"));

    const state = await press({ label: "At signing" });

    expect(state.formError).toBe(SNAPSHOT_PROBLEMS.failed);
    expect(state.fields.label).toBe("At signing");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("re-renders nothing when the capture was refused", async () => {
    captured.mockResolvedValue({ ok: false, reason: "empty-scope" });

    await press();

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
