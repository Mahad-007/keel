import { beforeEach, describe, expect, it, vi } from "vitest";

import { importDeliverables, listDeliverables } from "@/lib/data/deliverables";
import type { Deliverable } from "@/lib/db/schema";
import {
  IMPORT_PROBLEMS,
  INITIAL_IMPORT_STATE,
  INTENT_FIELD_NAME,
  STAMP_FIELD_NAME,
} from "@/lib/deliverables/import-form";
import { IMPORT_TEXT_PROBLEMS, IMPORT_NOTES } from "@/lib/deliverables/import";
import { matchesFingerprint } from "@/lib/forms/fingerprint";

import { writeScopeImport } from "./import-writes";

/**
 * Mocked collaborators rather than a database: this write's own job is the
 * branching — refuse the text, preview it, check the stamp, write it — and the
 * parsing and the writing are each already tested where they live.
 */
vi.mock("@/lib/data/deliverables", () => ({
  listDeliverables: vi.fn(),
  importDeliverables: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const listed = vi.mocked(listDeliverables);
const written = vi.mocked(importDeliverables);

/** Only the columns this write reads off a row it is handed. */
function row(id: string, title: string, estimatedMinutes = 0): Deliverable {
  return { id, title, estimatedMinutes } as Deliverable;
}

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function preview(lines: string) {
  return writeScopeImport(
    "prj_engine",
    INITIAL_IMPORT_STATE,
    submit({ lines, [INTENT_FIELD_NAME]: "preview" }),
  );
}

const PASTE = "Discovery | 2\nWireframes | 1.5";

beforeEach(() => {
  vi.clearAllMocks();
  listed.mockResolvedValue([]);
  written.mockResolvedValue({
    ok: true,
    deliverables: [row("dlv_one", "Discovery", 120), row("dlv_two", "Wireframes", 90)],
  });
});

describe("the preview press", () => {
  it("reads the paste and writes nothing", async () => {
    const state = await preview(PASTE);

    expect(written).not.toHaveBeenCalled();
    expect(state.previewed?.preview.drafts).toEqual([
      { title: "Discovery", estimatedMinutes: 120 },
      { title: "Wireframes", estimatedMinutes: 90 },
    ]);
    expect(state.imported).toBeNull();
  });

  it("stamps the paste it read, so the next press can be checked", async () => {
    const state = await preview(PASTE);

    expect(matchesFingerprint(state.previewed?.stamp ?? "", PASTE)).toBe(true);
  });

  it("previews a paste it could not read a line of", async () => {
    const state = await preview("Discovery | 2\n| 4");

    expect(state.previewed?.preview.problemCount).toBe(1);
    expect(state.formError).toBeNull();
  });

  it("remarks on a line that is already on the project's list", async () => {
    listed.mockResolvedValue([row("dlv_build", "Build")]);

    const state = await preview("Build | 2");

    expect(state.previewed?.preview.lines[0]).toMatchObject({
      ok: true,
      note: IMPORT_NOTES.agreed,
    });
  });

  it("refuses an empty box against the field, with nothing to preview", async () => {
    const state = await preview("   ");

    expect(state.errors.lines).toBe(IMPORT_TEXT_PROBLEMS.empty);
    expect(state.previewed).toBeNull();
    expect(listed).not.toHaveBeenCalled();
  });

  it("refuses a paste of more lines than can be checked", async () => {
    const tooMany = Array.from({ length: 101 }, (_, at) => `Line ${at}`).join("\n");

    const state = await preview(tooMany);

    expect(state.errors.lines).toContain("101 lines");
    expect(state.previewed).toBeNull();
  });

  it("says so when the project's own scope list cannot be read", async () => {
    listed.mockRejectedValue(new Error("libsql: connection refused"));

    const state = await preview(PASTE);

    expect(state.formError).toBe(IMPORT_PROBLEMS.previewFailed);
    expect(state.fields.lines).toBe(PASTE);
    expect(state.previewed).toBeNull();
  });

  it("keeps the paste as submitted, line endings aside", async () => {
    const state = await preview("Discovery | 2\r\nWireframes | 1.5");

    expect(state.fields.lines).toBe(PASTE);
  });

  it("previews a submission that names no press at all", async () => {
    const state = await writeScopeImport(
      "prj_engine",
      INITIAL_IMPORT_STATE,
      submit({ lines: PASTE }),
    );

    expect(written).not.toHaveBeenCalled();
    expect(state.previewed?.preview.drafts).toHaveLength(2);
  });
});

describe("the preview of a paste against another tab's additions", () => {
  it("reads the scope list fresh on every press", async () => {
    await preview(PASTE);
    await preview(PASTE);

    expect(listed).toHaveBeenCalledTimes(2);
    expect(listed).toHaveBeenCalledWith("prj_engine");
  });
});
