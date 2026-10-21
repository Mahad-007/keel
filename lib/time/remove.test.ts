import { describe, expect, it } from "vitest";

import { editTimeButtonId } from "./edit";
import {
  confirmDeleteTimeId,
  confirmDeleteTimeLabel,
  DELETE_TIME_CONFIRM_VALUE,
  deleteTimeButtonId,
  deletedTimeAnnouncement,
  deleteTimeButtonLabel,
  describeTimeDeletion,
  keepTimeEntryLabel,
  DELETE_TIME_NO_ANSWER,
  DELETE_TIME_PROBLEMS,
  readTimeDeletion,
  TIME_WRITE_DONE,
  timeWriteProblem,
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

describe("reading a confirmed deletion off a submission", () => {
  function submit(values: Record<string, string>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(values)) form.set(name, value);
    return form;
  }

  it("names the entry the confirming press was made on", () => {
    expect(
      readTimeDeletion(
        submit({ id: "tme_call", remove: DELETE_TIME_CONFIRM_VALUE }),
      ),
    ).toBe("tme_call");
  });

  it("deletes nothing for a submission carrying only an id", () => {
    // The step is the only form a time row has. Without this check, every
    // field in it would be a deletion waiting to happen.
    expect(readTimeDeletion(submit({ id: "tme_call" }))).toBeNull();
  });

  it("deletes nothing for a confirmation that names no entry", () => {
    expect(
      readTimeDeletion(submit({ remove: DELETE_TIME_CONFIRM_VALUE })),
    ).toBeNull();
    expect(
      readTimeDeletion(submit({ id: "  ", remove: DELETE_TIME_CONFIRM_VALUE })),
    ).toBeNull();
  });

  it("deletes nothing for an empty submission", () => {
    expect(readTimeDeletion(submit({}))).toBeNull();
  });

  it("takes any non-empty confirmation, because its presence is the message", () => {
    expect(readTimeDeletion(submit({ id: "tme_call", remove: "x" }))).toBe(
      "tme_call",
    );
  });

  it("trims the id, because whitespace is not a different row", () => {
    expect(
      readTimeDeletion(
        submit({ id: " tme_call ", remove: DELETE_TIME_CONFIRM_VALUE }),
      ),
    ).toBe("tme_call");
  });
});

describe("what a deletion says out loud", () => {
  it("names what went and counts what is left", () => {
    expect(deletedTimeAnnouncement(NAME, 675)).toBe(
      `Deleted ${NAME}. 11h 15m left on this project.`,
    );
  });

  it("counts the minutes rather than the entries", () => {
    // A time list is a list of minutes. "Nine entries left" is the one figure
    // that does not answer the question a deletion was about.
    expect(deletedTimeAnnouncement(NAME, 675)).not.toMatch(/entr/);
  });

  it("says the project has nothing logged rather than counting to zero", () => {
    expect(deletedTimeAnnouncement(NAME, 0)).toBe(
      `Deleted ${NAME}. No time is logged against this project now.`,
    );
  });

  it("says the same for a total that has somehow gone negative", () => {
    // Not reachable: minutes are positive and the deleted entry was one of
    // them. A page that renders is worth more than a figure of "-30m left".
    expect(deletedTimeAnnouncement(NAME, -30)).toContain("No time is logged");
  });
});

describe("what a deletion hands back", () => {
  it("says nothing at all when it landed", () => {
    expect(TIME_WRITE_DONE).toEqual({ ok: true });
  });

  it("carries one sentence when it did not", () => {
    expect(timeWriteProblem(DELETE_TIME_PROBLEMS.missing)).toEqual({
      ok: false,
      problem: DELETE_TIME_PROBLEMS.missing,
    });
  });
});

describe("the sentences a refused deletion comes back with", () => {
  it("tells a reader what to do rather than only what went wrong", () => {
    for (const problem of Object.values(DELETE_TIME_PROBLEMS)) {
      expect(problem).toMatch(/Reload|try again|credit note/);
    }
  });

  it("says nothing was deleted in every one of them", () => {
    for (const problem of Object.values(DELETE_TIME_PROBLEMS)) {
      expect(problem).toMatch(/nothing was deleted|Nothing was written|cannot be deleted/);
    }
  });

  it("points a billed entry at the credit note rather than at a retry", () => {
    expect(DELETE_TIME_PROBLEMS.billed).toContain("credit note");
    expect(DELETE_TIME_PROBLEMS.billed).not.toContain("try again");
  });

  it("does not claim either way when the answer never arrived", () => {
    expect(DELETE_TIME_NO_ANSWER).not.toMatch(/[Nn]othing was/);
    expect(DELETE_TIME_NO_ANSWER).toMatch(/Reload/);
  });
});
