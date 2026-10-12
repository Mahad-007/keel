import { describe, expect, it } from "vitest";

import { matchesFingerprint } from "@/lib/forms/fingerprint";

import { previewImport } from "./import";
import {
  INITIAL_IMPORT_STATE,
  INTENT_FIELD_NAME,
  previewedImportState,
  readImportFields,
  readImportIntent,
  readPreviewStamp,
  STAMP_FIELD_NAME,
} from "./import-form";

function submit(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

describe("the press a submission came from", () => {
  it("is an import when the import button named itself", () => {
    expect(readImportIntent(submit({ [INTENT_FIELD_NAME]: "import" }))).toBe(
      "import",
    );
  });

  it("is a preview when the preview button named itself", () => {
    expect(readImportIntent(submit({ [INTENT_FIELD_NAME]: "preview" }))).toBe(
      "preview",
    );
  });

  it("is a preview when no button named itself at all", () => {
    expect(readImportIntent(submit({ lines: "Discovery" }))).toBe("preview");
  });

  it("is a preview when the intent is something nobody offered", () => {
    expect(readImportIntent(submit({ [INTENT_FIELD_NAME]: "commit" }))).toBe(
      "preview",
    );
  });
});

describe("the paste a submission carried", () => {
  it("is read under the one field name the form has", () => {
    expect(readImportFields(submit({ lines: "Discovery\nBuild" }))).toEqual({
      lines: "Discovery\nBuild",
    });
  });

  it("reads a missing field as an empty paste rather than throwing", () => {
    expect(readImportFields(submit({}))).toEqual({ lines: "" });
  });

  it("normalises the line endings a textarea submits", () => {
    expect(readImportFields(submit({ lines: "Discovery\r\nBuild" }))).toEqual({
      lines: "Discovery\nBuild",
    });
  });
});

describe("the stamp a submission carried", () => {
  it("is read from the hidden field the preview filled in", () => {
    expect(readPreviewStamp(submit({ [STAMP_FIELD_NAME]: "d-1abc" }))).toBe(
      "d-1abc",
    );
  });

  it("is empty when nothing has been previewed yet", () => {
    expect(readPreviewStamp(submit({ lines: "Discovery" }))).toBe("");
  });
});

const PASTE = "Discovery | 2\nBuild";

function previewed(lines: string) {
  return previewedImportState({ lines }, previewImport(lines, []));
}

describe("the state the import form starts from", () => {
  it("has nothing pasted, nothing previewed and nothing imported", () => {
    expect(INITIAL_IMPORT_STATE).toEqual({
      fields: { lines: "" },
      errors: {},
      formError: null,
      previewed: null,
      imported: null,
    });
  });
});

describe("the state a preview comes back in", () => {
  it("keeps the paste, so the reader can edit the line the table flagged", () => {
    expect(previewed(PASTE).fields.lines).toBe(PASTE);
  });

  it("carries the lines the preview read", () => {
    expect(previewed(PASTE).previewed?.preview.drafts).toEqual([
      { title: "Discovery", estimatedMinutes: 120 },
      { title: "Build", estimatedMinutes: 0 },
    ]);
  });

  it("stamps the text it read, so the commit press can be checked", () => {
    const stamp = previewed(PASTE).previewed?.stamp ?? "";
    expect(matchesFingerprint(stamp, PASTE)).toBe(true);
  });

  it("stamps nothing that would match a different paste", () => {
    const stamp = previewed(PASTE).previewed?.stamp ?? "";
    expect(matchesFingerprint(stamp, `${PASTE}\nLaunch`)).toBe(false);
  });

  it("says nothing is wrong and nothing was written", () => {
    const state = previewed(PASTE);
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
    expect(state.imported).toBeNull();
  });

  it("previews a paste it could not read a line of, rather than refusing", () => {
    const state = previewed("| 2");
    expect(state.previewed?.preview.problemCount).toBe(1);
    expect(state.formError).toBeNull();
  });
});
