import { describe, expect, it } from "vitest";

import type { Deliverable } from "@/lib/db/schema";

import {
  changesDeliverable,
  EDIT_NO_ANSWER,
  savedNotice,
  deliverableChanges,
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

describe("what an edit changes about the stored row", () => {
  const before = stored();

  function changes(values: Partial<Parameters<typeof deliverableChanges>[1]>) {
    return deliverableChanges(before, {
      title: "Wireframes",
      description: "Six screens.",
      estimatedMinutes: 90,
      ...values,
    });
  }

  it("is nothing at all when the form was saved untouched", () => {
    expect(changes({})).toEqual({});
    expect(changesDeliverable(changes({}))).toBe(false);
  });

  it("names only the field that moved", () => {
    expect(changes({ title: "Wireframes, revised" })).toEqual({
      title: "Wireframes, revised",
    });
    expect(changes({ estimatedMinutes: 120 })).toEqual({
      estimatedMinutes: 120,
    });
  });

  it("carries a cleared description as null rather than leaving it alone", () => {
    expect(changes({ description: null })).toEqual({ description: null });
  });

  it("does not see a change when the description was already missing", () => {
    expect(
      deliverableChanges(stored({ description: null }), {
        title: "Wireframes",
        description: null,
        estimatedMinutes: 90,
      }),
    ).toEqual({});
  });

  it("reads an absent description as the empty box it came from", () => {
    // `title` is the only field the form requires, so a value built from one
    // may leave the other two out — and out means blank, not unchanged.
    expect(
      deliverableChanges(stored(), { title: "Wireframes" }),
    ).toEqual({ description: null, estimatedMinutes: 0 });
  });

  it("carries an estimate cleared back to nothing", () => {
    expect(changes({ estimatedMinutes: 0 })).toEqual({ estimatedMinutes: 0 });
    expect(changesDeliverable(changes({ estimatedMinutes: 0 }))).toBe(true);
  });

  it("names all three when all three moved", () => {
    expect(
      changes({ title: "Flows", description: null, estimatedMinutes: 0 }),
    ).toEqual({ title: "Flows", description: null, estimatedMinutes: 0 });
  });

  it("leaves the status and the position out of a patch entirely", () => {
    // Neither is the form's to change: the row's controls own both, and a save
    // that could rearrange the list would be a save nobody could trust.
    expect(
      Object.keys(changes({ title: "Flows", estimatedMinutes: 15 })),
    ).toEqual(["title", "estimatedMinutes"]);
  });
});

describe("the sentence a save comes back with", () => {
  const fields = { title: "Wireframes", description: "", estimate: "2" };

  it("names the line that was saved", () => {
    const state = savedEditState(
      { id: "dlv_wire", title: "Wireframes", changed: true },
      fields,
    );
    expect(savedNotice(state)).toBe("Saved “Wireframes”.");
  });

  it("names the title as saved, not as the form opened", () => {
    const state = savedEditState(
      { id: "dlv_wire", title: "Wireframes, revised", changed: true },
      fields,
    );
    expect(savedNotice(state)).toBe("Saved “Wireframes, revised”.");
  });

  it("does not claim a change when there was none", () => {
    const state = savedEditState(
      { id: "dlv_wire", title: "Wireframes", changed: false },
      fields,
    );
    expect(savedNotice(state)).toBe(
      "No changes to save — “Wireframes” is as it was.",
    );
  });

  it("has nothing to say about a form that has not been saved", () => {
    expect(savedNotice(editDeliverableState(stored()))).toBeNull();
    expect(savedNotice(rejectedEditState(fields, { title: "Required." }))).toBeNull();
  });
});

describe("the sentence an edit with no answer comes back with", () => {
  it("does not claim the edit was lost, because nobody here knows", () => {
    expect(EDIT_NO_ANSWER).not.toMatch(/nothing was (written|saved)/i);
  });

  it("sends the reader to the list, which is what the server says", () => {
    expect(EDIT_NO_ANSWER).toMatch(/Reload/);
  });
});
