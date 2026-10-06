import { describe, expect, it } from "vitest";

import type { Deliverable } from "@/lib/db/schema";

import {
  editDeliverableState,
  failedEditState,
  rejectedEditState,
  savedEditState,
} from "./edit";

function stored(values: Partial<Deliverable> = {}): Deliverable {
  return {
    id: "dlv_wire",
    projectId: "prj_engine",
    title: "Wireframes",
    description: "Six screens.",
    estimatedMinutes: 90,
    status: "pending",
    sortOrder: 0,
    createdAt: "2026-10-03T09:00:00.000Z",
    updatedAt: "2026-10-03T09:00:00.000Z",
    ...values,
  };
}

describe("the form an edit opens with", () => {
  it("starts from the stored line with nothing wrong yet", () => {
    expect(editDeliverableState(stored())).toEqual({
      fields: {
        title: "Wireframes",
        description: "Six screens.",
        estimate: "1.5",
      },
      errors: {},
      formError: null,
      saved: null,
    });
  });
});

describe("an edit that landed", () => {
  const fields = {
    title: "Wireframes",
    description: "",
    estimate: "2",
  };

  it("says which row was saved and under what title", () => {
    const state = savedEditState(
      { id: "dlv_wire", title: "Wireframes", changed: true },
      fields,
    );
    expect(state.saved).toEqual({
      id: "dlv_wire",
      title: "Wireframes",
      changed: true,
    });
  });

  it("holds the row as it now reads, not as it was typed", () => {
    const state = savedEditState(
      { id: "dlv_wire", title: "Wireframes", changed: true },
      fields,
    );
    expect(state.fields).toEqual(fields);
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });
});

describe("an edit that was refused", () => {
  it("keeps what was typed, so the row can stay open on it", () => {
    const fields = { title: "", description: "Six screens.", estimate: "1.5" };
    const state = rejectedEditState(fields, { title: "Title is required." });

    expect(state.fields).toEqual(fields);
    expect(state.errors).toEqual({ title: "Title is required." });
    expect(state.saved).toBeNull();
  });

  it("keeps what was typed when the write itself failed", () => {
    const fields = { title: "Wireframes", description: "", estimate: "1.5" };
    const state = failedEditState(fields, "Could not save that change.");

    expect(state.fields).toEqual(fields);
    expect(state.errors).toEqual({});
    expect(state.formError).toBe("Could not save that change.");
    expect(state.saved).toBeNull();
  });
});
