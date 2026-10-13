import { describe, expect, it } from "vitest";

import {
  failedSnapshotState,
  INITIAL_TAKE_SNAPSHOT_STATE,
  parseSnapshotForm,
  readSnapshotFields,
  rejectedSnapshotState,
  SNAPSHOT_LABEL_LIMIT,
  takenSnapshotNotice,
  takenSnapshotState,
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

describe("takenSnapshotState", () => {
  it("empties the box, because the label has been filed", () => {
    const state = takenSnapshotState({
      id: "snp_1",
      label: "Signed proposal",
      lineCount: 4,
    });

    expect(state.fields).toEqual({ label: "" });
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
    expect(state.taken).not.toBeNull();
  });
});

describe("rejectedSnapshotState", () => {
  it("echoes what was typed and records nothing as taken", () => {
    const state = rejectedSnapshotState(
      { label: "x".repeat(200) },
      { label: "Too long." },
    );

    expect(state.fields.label).toHaveLength(200);
    expect(state.errors.label).toBe("Too long.");
    expect(state.taken).toBeNull();
  });
});

describe("failedSnapshotState", () => {
  it("keeps the label and says what went wrong for the whole form", () => {
    const state = failedSnapshotState({ label: "At signing" }, "No answer.");

    expect(state.fields.label).toBe("At signing");
    expect(state.formError).toBe("No answer.");
    expect(state.taken).toBeNull();
  });
});

describe("takenSnapshotNotice", () => {
  it("says nothing before anything has been recorded", () => {
    expect(takenSnapshotNotice(INITIAL_TAKE_SNAPSHOT_STATE)).toBeNull();
  });

  it("names the label it was filed under and how many lines went in", () => {
    expect(
      takenSnapshotNotice(
        takenSnapshotState({
          id: "snp_1",
          label: "Signed proposal",
          lineCount: 4,
        }),
      ),
    ).toBe(
      "Recorded a snapshot of this project's 4 deliverables as “Signed proposal”.",
    );
  });

  it("agrees the noun with a scope list of one", () => {
    expect(
      takenSnapshotNotice(
        takenSnapshotState({ id: "snp_1", label: null, lineCount: 1 }),
      ),
    ).toBe("Recorded a snapshot of this project's one deliverable, dated today.");
  });

  it("describes an unlabelled snapshot by what it is", () => {
    // "Recorded ???" would be neither true nor findable.
    expect(
      takenSnapshotNotice(
        takenSnapshotState({ id: "snp_1", label: null, lineCount: 9 }),
      ),
    ).toBe(
      "Recorded a snapshot of this project's 9 deliverables, dated today.",
    );
  });
});
