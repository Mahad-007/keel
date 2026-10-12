import { describe, expect, it } from "vitest";

import { matchesFingerprint } from "@/lib/forms/fingerprint";

import { previewImport } from "./import";
import {
  INITIAL_IMPORT_STATE,
  INTENT_FIELD_NAME,
  importedNotice,
  importedScopeState,
  previewedImportState,
  previewedPaste,
  refusedImportState,
  rejectedImportState,
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

const LANDED = {
  deliverableIds: ["dlv_one", "dlv_two"],
  estimatedMinutes: 120,
};

describe("the state a committed import comes back in", () => {
  it("names what was written", () => {
    expect(importedScopeState(LANDED).imported).toEqual(LANDED);
  });

  it("empties the box, so the same list cannot be imported twice", () => {
    expect(importedScopeState(LANDED).fields).toEqual({ lines: "" });
  });

  it("drops the preview, which now describes rows that exist", () => {
    expect(importedScopeState(LANDED).previewed).toBeNull();
  });

  it("tells two imports of the same list apart by the rows written", () => {
    const first = importedScopeState({ ...LANDED, deliverableIds: ["dlv_a"] });
    const again = importedScopeState({ ...LANDED, deliverableIds: ["dlv_b"] });
    expect(first.imported).not.toEqual(again.imported);
  });
});

describe("the state a refused paste comes back in", () => {
  it("keeps what was pasted and says which field is wrong", () => {
    const state = rejectedImportState(
      { lines: "   " },
      { lines: "Paste a scope list to import." },
    );
    expect(state.fields).toEqual({ lines: "   " });
    expect(state.errors).toEqual({ lines: "Paste a scope list to import." });
  });

  it("has nothing to preview, because nothing was read", () => {
    expect(rejectedImportState({ lines: "" }, { lines: "No." }).previewed).toBeNull();
  });
});

describe("the state a press that wrote nothing comes back in", () => {
  const paste = previewedPaste(PASTE, previewImport(PASTE, []));
  const state = refusedImportState({ lines: PASTE }, paste, "Nothing landed.");

  it("says what stopped it, against the form rather than a field", () => {
    expect(state.formError).toBe("Nothing landed.");
    expect(state.errors).toEqual({});
  });

  it("keeps the preview, so the reader can press Import again", () => {
    expect(state.previewed).toBe(paste);
  });

  it("wrote nothing", () => {
    expect(state.imported).toBeNull();
  });

  it("can come back without a preview when there was none to make", () => {
    expect(
      refusedImportState({ lines: PASTE }, null, "Nothing landed.").previewed,
    ).toBeNull();
  });
});

describe("the sentence a committed import leaves behind", () => {
  it("names the count, the total and where the lines went", () => {
    expect(importedNotice(importedScopeState(LANDED))).toBe(
      "Added 2 deliverables and 2h to the end of the scope list.",
    );
  });

  it("counts one line in the singular", () => {
    expect(
      importedNotice(
        importedScopeState({ deliverableIds: ["dlv_one"], estimatedMinutes: 30 }),
      ),
    ).toBe("Added 1 deliverable and 30m to the end of the scope list.");
  });

  it("says a list with no estimates is unsized rather than free", () => {
    expect(
      importedNotice(
        importedScopeState({
          deliverableIds: ["dlv_one", "dlv_two", "dlv_three"],
          estimatedMinutes: 0,
        }),
      ),
    ).toBe(
      "Added 3 deliverables to the end of the scope list, none of them estimated.",
    );
  });

  it("says nothing before anything has been imported", () => {
    expect(importedNotice(INITIAL_IMPORT_STATE)).toBeNull();
    expect(importedNotice(previewed(PASTE))).toBeNull();
  });

  it("says nothing about a press that wrote nothing", () => {
    expect(
      importedNotice(refusedImportState({ lines: PASTE }, null, "No.")),
    ).toBeNull();
  });
});
