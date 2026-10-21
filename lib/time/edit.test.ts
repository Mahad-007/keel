import { describe, expect, it } from "vitest";

import {
  cancelTimeEditLabel,
  changesTimeEntry,
  EDIT_TIME_NO_ANSWER,
  EDIT_TIME_PROBLEMS,
  editAttributionOptions,
  editTimeButtonId,
  editTimeButtonLabel,
  editTimeFormLabel,
  editTimeState,
  failedTimeEditState,
  readTimeEntryId,
  rejectedTimeEditState,
  savedTimeNotice,
  savedTimeState,
  timeEntryChanges,
  timeEntryFormFields,
} from "./edit";
import type { ListedTimeEntry } from "./entry";
import {
  parseLogTimeForm,
  readsAsBillable,
  type LogTimeFormValue,
} from "./form";

function listed(fields: Partial<ListedTimeEntry> = {}): ListedTimeEntry {
  return {
    id: "tme_1",
    minutes: 90,
    note: null,
    workedOn: "2026-10-17",
    deliverableId: null,
    billable: true,
    billedInvoiceId: null,
    ...fields,
  };
}

describe("the stored entry as the form's boxes", () => {
  it("writes the duration in units rather than as bare minutes", () => {
    // `360` in the box invites a reader correcting six hours to type `6.5`,
    // which the field reads as six and a half minutes.
    expect(timeEntryFormFields(listed({ minutes: 360 })).duration).toBe("6h");
  });

  it("carries the day across unchanged", () => {
    expect(timeEntryFormFields(listed()).workedOn).toBe("2026-10-17");
  });

  it("selects the line the entry was attributed to", () => {
    expect(
      timeEntryFormFields(listed({ deliverableId: "dlv_wire" })).deliverable,
    ).toBe("dlv_wire");
  });

  it("leaves the picker on the project itself for unattributed work", () => {
    expect(timeEntryFormFields(listed()).deliverable).toBe("");
  });

  it("puts a note in the box and an absent one leaves it empty", () => {
    expect(timeEntryFormFields(listed({ note: "Booking flow" })).note).toBe(
      "Booking flow",
    );
    expect(timeEntryFormFields(listed()).note).toBe("");
  });

  it("ticks the chargeable box with the value a browser would submit", () => {
    expect(readsAsBillable(timeEntryFormFields(listed()).billable)).toBe(true);
  });

  it("leaves the chargeable box blank for time nobody is charged for", () => {
    const fields = timeEntryFormFields(listed({ billable: false }));
    expect(fields.billable).toBe("");
    expect(readsAsBillable(fields.billable)).toBe(false);
  });
});

describe("opening an entry and saving it untouched", () => {
  /**
   * The property the whole prefill exists for: what the form opens holding has
   * to parse back to the row it came from. Any field that did not round-trip
   * would be rewritten on every save of an untouched form.
   */
  function roundTrip(entry: ListedTimeEntry) {
    const parsed = parseLogTimeForm(
      timeEntryFormFields(entry),
      entry.deliverableId === null ? [] : [entry.deliverableId],
    );
    if (!parsed.ok) throw new Error("the prefilled form was refused");
    return parsed.value;
  }

  it("writes back exactly what was stored", () => {
    const entry = listed({
      minutes: 95,
      note: "Paired on the booking flow",
      deliverableId: "dlv_wire",
      billable: false,
    });
    expect(roundTrip(entry)).toEqual({
      minutes: 95,
      workedOn: "2026-10-17",
      deliverableId: "dlv_wire",
      note: "Paired on the booking flow",
      billable: false,
    });
  });

  it("keeps every duration a day can hold", () => {
    // Every minute from one to a full day, because the prefill is only as good
    // as its worst value and `formatMinutes` has three branches.
    for (let minutes = 1; minutes <= 24 * 60; minutes += 1) {
      expect(roundTrip(listed({ minutes })).minutes).toBe(minutes);
    }
  });
});

describe("the state an edit form opens in", () => {
  it("holds the stored entry and nothing wrong with it", () => {
    const state = editTimeState(listed({ note: "Booking flow" }));
    expect(state.fields.note).toBe("Booking flow");
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });

  it("has nothing saved yet, so the row stays open", () => {
    expect(editTimeState(listed()).saved).toBeNull();
  });
});

describe("the state a landed edit comes back in", () => {
  const saved = { id: "tme_1", name: "1h 30m on Oct 17, 2026", changed: true };

  it("shows the row as saved rather than as submitted", () => {
    const state = savedTimeState(saved, {
      ...timeEntryFormFields(listed()),
      note: "Trimmed",
    });
    expect(state.fields.note).toBe("Trimmed");
    expect(state.saved).toBe(saved);
  });

  it("has nothing wrong with it, so the summary stays quiet", () => {
    const state = savedTimeState(saved, timeEntryFormFields(listed()));
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });
});

describe("the state a refused edit comes back in", () => {
  it("keeps what was typed so the work is not thrown away", () => {
    const fields = { ...timeEntryFormFields(listed()), duration: "banana" };
    const state = rejectedTimeEditState(fields, {
      duration: "That is not a length of time.",
    });
    expect(state.fields.duration).toBe("banana");
    expect(state.errors.duration).toBe("That is not a length of time.");
    expect(state.saved).toBeNull();
  });

  it("puts a problem with the submission as a whole above the fields", () => {
    const fields = timeEntryFormFields(listed());
    const state = failedTimeEditState(fields, "Nothing was written.");
    expect(state.formError).toBe("Nothing was written.");
    expect(state.errors).toEqual({});
    expect(state.saved).toBeNull();
  });
});

describe("what a submitted edit changes about the stored entry", () => {
  const before = listed({
    minutes: 90,
    note: "Booking flow",
    workedOn: "2026-10-17",
    deliverableId: "dlv_wire",
    billable: true,
  });

  function submitted(changes: Partial<LogTimeFormValue> = {}) {
    return {
      minutes: 90,
      workedOn: "2026-10-17",
      note: "Booking flow",
      deliverableId: "dlv_wire",
      billable: true,
      ...changes,
    };
  }

  it("asks for nothing when nothing moved", () => {
    const patch = timeEntryChanges(before, submitted());
    expect(patch).toEqual({});
    expect(changesTimeEntry(patch)).toBe(false);
  });

  it("names only the column that moved", () => {
    expect(timeEntryChanges(before, submitted({ minutes: 120 }))).toEqual({
      minutes: 120,
    });
  });

  it("re-dates an entry filed under the wrong day", () => {
    expect(
      timeEntryChanges(before, submitted({ workedOn: "2026-10-16" })),
    ).toEqual({ workedOn: "2026-10-16" });
  });

  it("clears a note that was emptied", () => {
    expect(timeEntryChanges(before, submitted({ note: null }))).toEqual({
      note: null,
    });
  });

  it("reads an absent note as no note rather than as no change", () => {
    const { note: _note, ...withoutNote } = submitted();
    expect(timeEntryChanges(before, withoutNote)).toEqual({ note: null });
  });

  it("moves the attribution onto another line", () => {
    expect(
      timeEntryChanges(before, submitted({ deliverableId: "dlv_build" })),
    ).toEqual({ deliverableId: "dlv_build" });
  });

  it("takes the attribution off onto the project itself", () => {
    expect(
      timeEntryChanges(before, submitted({ deliverableId: null })),
    ).toEqual({ deliverableId: null });
  });

  it("asks for nothing when unattributed work stays unattributed", () => {
    const unattributed = { ...before, deliverableId: null };
    const patch = timeEntryChanges(
      unattributed,
      submitted({ deliverableId: null }),
    );
    expect(patch).toEqual({});
  });

  it("unticks the chargeable flag", () => {
    expect(timeEntryChanges(before, submitted({ billable: false }))).toEqual({
      billable: false,
    });
  });

  it("reads an absent chargeable flag as chargeable", () => {
    const { billable: _billable, ...withoutFlag } = submitted();
    expect(timeEntryChanges(before, withoutFlag)).toEqual({});
  });

  it("normalises a stored flag that is neither true nor false", () => {
    // The column is an integer and a hand-edited row can hold anything. An
    // edit is the chance to write a real boolean back.
    const odd = { ...before, billable: 2 as unknown as boolean };
    expect(timeEntryChanges(odd, submitted())).toEqual({ billable: true });
  });

  it("names several columns at once when several moved", () => {
    const patch = timeEntryChanges(
      before,
      submitted({ minutes: 45, note: null, billable: false }),
    );
    expect(patch).toEqual({ minutes: 45, note: null, billable: false });
    expect(changesTimeEntry(patch)).toBe(true);
  });
});

describe("what is said once an edit lands", () => {
  const name = "1h 30m on Oct 17, 2026 against “Wireframes”";

  it("says nothing while nothing has landed", () => {
    expect(savedTimeNotice(editTimeState(listed()))).toBeNull();
  });

  it("names the entry as it now stands", () => {
    const state = savedTimeState(
      { id: "tme_1", name, changed: true },
      timeEntryFormFields(listed()),
    );
    expect(savedTimeNotice(state)).toBe(`Saved ${name}.`);
  });

  it("does not claim a save that wrote nothing changed something", () => {
    const state = savedTimeState(
      { id: "tme_1", name, changed: false },
      timeEntryFormFields(listed()),
    );
    expect(savedTimeNotice(state)).toBe(
      `No changes to save — that entry is as it was: ${name}.`,
    );
  });

  it("says nothing about a refused submission", () => {
    const state = rejectedTimeEditState(timeEntryFormFields(listed()), {
      duration: "That is not a length of time.",
    });
    expect(savedTimeNotice(state)).toBeNull();
  });
});

describe("the sentences a refused save comes back with", () => {
  it("tells a reader what to do rather than only what went wrong", () => {
    for (const problem of Object.values(EDIT_TIME_PROBLEMS)) {
      expect(problem).toMatch(/Reload|try again|credit note/);
    }
  });

  it("says nothing was saved in every one of them", () => {
    for (const problem of Object.values(EDIT_TIME_PROBLEMS)) {
      expect(problem).toMatch(/[Nn]othing was (saved|written)/);
    }
  });

  it("does not claim nothing was written when the answer never arrived", () => {
    // From the client there is no way to know, and a guess is wrong exactly
    // when it matters.
    expect(EDIT_TIME_NO_ANSWER).not.toMatch(/[Nn]othing was/);
    expect(EDIT_TIME_NO_ANSWER).toMatch(/Reload/);
  });

  it("points a billed entry at the credit note rather than at a retry", () => {
    expect(EDIT_TIME_PROBLEMS.billed).toContain("credit note");
    expect(EDIT_TIME_PROBLEMS.billed).not.toContain("try again");
  });
});

describe("which entry a submission was aimed at", () => {
  function submit(values: Record<string, string>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(values)) form.set(name, value);
    return form;
  }

  it("reads the id out of the field the form writes it in", () => {
    expect(readTimeEntryId(submit({ id: "tme_call" }))).toBe("tme_call");
  });

  it("trims it, because whitespace is not a different row", () => {
    expect(readTimeEntryId(submit({ id: " tme_call " }))).toBe("tme_call");
  });

  it("comes back empty for a submission that did not say", () => {
    expect(readTimeEntryId(submit({}))).toBe("");
    expect(readTimeEntryId(submit({ id: "   " }))).toBe("");
  });
});

describe("what an entry's edit controls are called", () => {
  const name = "1h 30m on Oct 17, 2026 against “Wireframes”";

  it("names the entry each one acts on", () => {
    expect(editTimeButtonLabel(name)).toBe(`Edit ${name}`);
    expect(editTimeFormLabel(name)).toBe(`Editing ${name}`);
    expect(cancelTimeEditLabel(name)).toBe(`Stop editing ${name}`);
  });

  it("tells the button that opens the editor from the editor itself", () => {
    // Only one is in the document at a time, but a reader moving between them
    // should not hear the same words for the press and the place.
    expect(editTimeButtonLabel(name)).not.toBe(editTimeFormLabel(name));
  });
});

describe("the id an entry's edit button is found by", () => {
  it("keeps two rows' buttons apart", () => {
    expect(editTimeButtonId("tme_a")).not.toBe(editTimeButtonId("tme_b"));
  });

  it("does not run one row's id into another's", () => {
    expect(editTimeButtonId("tme_a")).not.toBe(editTimeButtonId("tme_a_b"));
  });

  it("says what it belongs to, so a scope row cannot claim it", () => {
    expect(editTimeButtonId("tme_a")).toMatch(/^time-/);
  });
});

describe("the lines an editor's picker offers", () => {
  const options = [
    { id: "dlv_wire", label: "Wireframes · 6h estimated" },
    { id: "dlv_build", label: "Build · no estimate" },
  ];

  it("offers the project's list to an unattributed entry", () => {
    expect(editAttributionOptions(listed(), options)).toBe(options);
  });

  it("offers the project's list when it holds the entry's own line", () => {
    const entry = listed({ deliverableId: "dlv_build" });
    expect(editAttributionOptions(entry, options)).toBe(options);
  });

  it("keeps a line the project's list does not hold on the picker", () => {
    // Without it the select would fall back to its placeholder, and saving the
    // form untouched would null an attribution nobody asked to remove.
    const entry = listed({ deliverableId: "dlv_gone" });
    const offered = editAttributionOptions(entry, options);

    expect(offered).toHaveLength(3);
    expect(offered[2].id).toBe("dlv_gone");
  });

  it("says of that line only that this page cannot show it", () => {
    const entry = listed({ deliverableId: "dlv_gone" });
    const [, , unshown] = editAttributionOptions(entry, options);
    expect(unshown.label).toMatch(/cannot show/);
  });

  it("leaves the project's own lines in the order they were agreed", () => {
    const entry = listed({ deliverableId: "dlv_gone" });
    const offered = editAttributionOptions(entry, options);
    expect(offered.slice(0, 2)).toEqual(options);
  });

  it("offers it even when the project has no scope list at all", () => {
    const entry = listed({ deliverableId: "dlv_gone" });
    expect(editAttributionOptions(entry, [])).toHaveLength(1);
  });

  it("is an option a submission would be refused for", () => {
    // Deliberately: the sentence beside the picker is better news than a
    // silently emptied column.
    const entry = listed({ deliverableId: "dlv_gone" });
    const offered = editAttributionOptions(entry, options);
    const parsed = parseLogTimeForm(
      { ...timeEntryFormFields(entry), deliverable: offered[2].id },
      options.map((option) => option.id),
    );

    expect(parsed.ok).toBe(false);
  });
});
