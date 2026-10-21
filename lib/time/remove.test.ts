import { describe, expect, it } from "vitest";

import { editTimeButtonId } from "./edit";
import {
  confirmDeleteTimeId,
  confirmDeleteTimeLabel,
  deleteTimeButtonId,
  deleteTimeButtonLabel,
  describeTimeDeletion,
  keepTimeEntryLabel,
  timeDeletePromptId,
} from "./remove";

const NAME = "1h 30m on Oct 17, 2026 against “Wireframes”";

describe("what an entry's delete controls are called", () => {
  it("names the entry each one acts on", () => {
    expect(deleteTimeButtonLabel(NAME)).toBe(`Delete ${NAME}`);
    expect(keepTimeEntryLabel(NAME)).toBe(`Keep ${NAME}`);
  });

  it("tells the press that asks apart from the press that deletes", () => {
    // Both are in the document while the step is open. Two controls with the
    // same accessible name is exactly the confusion this step exists to avoid.
    expect(confirmDeleteTimeLabel(NAME)).not.toBe(deleteTimeButtonLabel(NAME));
  });
});

describe("the sentence in front of a deletion", () => {
  it("names the entry and says nothing comes back", () => {
    const said = describeTimeDeletion(NAME, true);
    expect(said).toContain(`Delete ${NAME}?`);
    expect(said).toContain("cannot be undone");
  });

  it("offers the chargeable flag, which is what the reader usually meant", () => {
    expect(describeTimeDeletion(NAME, true)).toContain("untick Chargeable");
  });

  it("says the flag keeps the work on the project and off the invoice", () => {
    expect(describeTimeDeletion(NAME, true)).toContain(
      "keeps it on the project and off the invoice",
    );
  });

  it("does not offer it to an entry that is already not chargeable", () => {
    // Suggesting something the reader has already done reads as a page that
    // has not looked at the row.
    expect(describeTimeDeletion(NAME, false)).not.toContain("Chargeable");
  });

  it("asks about the entry rather than about the reader's state of mind", () => {
    expect(describeTimeDeletion(NAME, true)).not.toMatch(/sure/i);
  });
});

describe("the ids an entry's delete controls are found by", () => {
  it("gives the step, the confirming button and the asking button their own", () => {
    const ids = [
      timeDeletePromptId("tme_a"),
      confirmDeleteTimeId("tme_a"),
      deleteTimeButtonId("tme_a"),
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps two rows' controls apart", () => {
    expect(deleteTimeButtonId("tme_a")).not.toBe(deleteTimeButtonId("tme_b"));
    expect(confirmDeleteTimeId("tme_a")).not.toBe(confirmDeleteTimeId("tme_b"));
  });

  it("does not run one row's id into another's", () => {
    expect(timeDeletePromptId("tme_a")).not.toBe(timeDeletePromptId("tme_a_b"));
  });

  it("does not collide with the same row's edit button", () => {
    expect(deleteTimeButtonId("tme_a")).not.toBe(editTimeButtonId("tme_a"));
  });
});
