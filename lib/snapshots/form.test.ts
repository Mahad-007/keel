import { describe, expect, it } from "vitest";

import {
  parseSnapshotForm,
  readSnapshotFields,
  SNAPSHOT_LABEL_LIMIT,
} from "./form";

describe("readSnapshotFields", () => {
  it("reads the label off a submission", () => {
    const formData = new FormData();
    formData.set("label", "Signed proposal");

    expect(readSnapshotFields(formData)).toEqual({ label: "Signed proposal" });
  });

  it("reads a field the browser never sent as empty", () => {
    expect(readSnapshotFields(new FormData())).toEqual({ label: "" });
  });
});

describe("parseSnapshotForm", () => {
  it("accepts a label and trims it", () => {
    expect(parseSnapshotForm({ label: "  Signed proposal  " })).toEqual({
      ok: true,
      value: { label: "Signed proposal" },
    });
  });

  it("accepts a snapshot nobody named, as NULL", () => {
    // A snapshot has a date on it, so a label is a convenience rather than
    // the thing that identifies it.
    expect(parseSnapshotForm({ label: "" })).toEqual({
      ok: true,
      value: { label: null },
    });
  });

  it("treats a label of only spaces as no label", () => {
    expect(parseSnapshotForm({ label: "   " })).toEqual({
      ok: true,
      value: { label: null },
    });
  });

  it("accepts a label exactly at the limit", () => {
    const label = "x".repeat(SNAPSHOT_LABEL_LIMIT);

    expect(parseSnapshotForm({ label })).toEqual({
      ok: true,
      value: { label },
    });
  });

  it("refuses a label past the limit, naming the field", () => {
    const parsed = parseSnapshotForm({
      label: "x".repeat(SNAPSHOT_LABEL_LIMIT + 1),
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.label).toMatch(/Label must be 80 characters or fewer/);
  });
});
