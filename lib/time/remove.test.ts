import { describe, expect, it } from "vitest";

import {
  confirmDeleteTimeLabel,
  deleteTimeButtonLabel,
  describeTimeDeletion,
  keepTimeEntryLabel,
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
