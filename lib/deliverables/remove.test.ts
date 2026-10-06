import { describe, expect, it } from "vitest";

import {
  confirmDeleteLabel,
  deleteButtonLabel,
  deletedAnnouncement,
  describeDeletion,
  keepDeliverableLabel,
} from "./remove";

describe("what the delete controls are called", () => {
  it("names the line each one acts on", () => {
    expect(deleteButtonLabel("Wireframes")).toBe("Delete “Wireframes”");
    expect(keepDeliverableLabel("Wireframes")).toBe("Keep “Wireframes”");
  });

  it("tells the press that asks apart from the press that deletes", () => {
    // Both are in the document while the step is open. Two controls with the
    // same accessible name is exactly the confusion this step exists to avoid.
    expect(confirmDeleteLabel("Wireframes")).not.toBe(
      deleteButtonLabel("Wireframes"),
    );
  });
});

describe("the sentence in front of a deletion", () => {
  it("names the line and says nothing comes back", () => {
    const said = describeDeletion("Wireframes", 90);
    expect(said).toMatch(/Delete “Wireframes”\?/);
    expect(said).toMatch(/cannot be undone/);
  });

  it("says what the estimate takes off the project with it", () => {
    expect(describeDeletion("Wireframes", 90)).toContain(
      "Its estimate of 1h 30m comes off the project's scope with it.",
    );
  });

  it("says a line nobody estimated changes no figure", () => {
    expect(describeDeletion("Wireframes", 0)).toContain(
      "It has no estimate, so no scope figure changes.",
    );
  });

  it("does not ask whether the reader is sure", () => {
    // The question is not about their state of mind. It is about what is lost,
    // which is the thing a browser dialogue cannot be made to say.
    expect(describeDeletion("Wireframes", 90)).not.toMatch(/sure/i);
  });
});

describe("the sentence after a deletion", () => {
  it("names the line and counts what is left", () => {
    expect(deletedAnnouncement("Wireframes", 3)).toBe(
      "Deleted “Wireframes”. 3 deliverables left.",
    );
  });

  it("says one deliverable in words, not as a figure with a plural", () => {
    expect(deletedAnnouncement("Wireframes", 1)).toBe(
      "Deleted “Wireframes”. One deliverable left.",
    );
  });

  it("says the list is empty rather than counting zero of them", () => {
    expect(deletedAnnouncement("Wireframes", 0)).toBe(
      "Deleted “Wireframes”. The scope list is now empty.",
    );
  });
});
