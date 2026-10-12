import { describe, expect, it } from "vitest";

import {
  INTENT_FIELD_NAME,
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
