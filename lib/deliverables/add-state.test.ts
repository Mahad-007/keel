import { describe, expect, it } from "vitest";

import {
  addedDeliverableState,
  EMPTY_DELIVERABLE_FIELDS,
  failedAddState,
  INITIAL_ADD_DELIVERABLE_STATE,
  rejectedAddState,
} from "./form";

const typed = {
  title: "Wireframes",
  description: "Six screens.",
  estimate: "1.5",
};

describe("the state the add line starts from", () => {
  it("has nothing typed, nothing wrong, and nothing added", () => {
    expect(INITIAL_ADD_DELIVERABLE_STATE).toEqual({
      fields: EMPTY_DELIVERABLE_FIELDS,
      errors: {},
      formError: null,
      added: null,
    });
  });
});

describe("the state after a deliverable is added", () => {
  it("names what landed, so the form can say so", () => {
    expect(addedDeliverableState("Wireframes").added).toBe("Wireframes");
  });

  it("empties the fields, so the next line is not a copy of the last", () => {
    expect(addedDeliverableState("Wireframes").fields).toEqual(
      EMPTY_DELIVERABLE_FIELDS,
    );
  });
});

describe("the state after a submission that wrote nothing", () => {
  it("keeps what was typed and says which field is wrong", () => {
    const state = rejectedAddState(typed, { title: "Title is required." });
    expect(state).toEqual({
      fields: typed,
      errors: { title: "Title is required." },
      formError: null,
      added: null,
    });
  });

  it("keeps what was typed when the save itself failed", () => {
    const state = failedAddState(typed, "Could not save it.");
    expect(state).toEqual({
      fields: typed,
      errors: {},
      formError: "Could not save it.",
      added: null,
    });
  });
});
