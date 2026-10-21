import { describe, expect, it } from "vitest";

import {
  changesTimeEntry,
  editTimeState,
  failedTimeEditState,
  rejectedTimeEditState,
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
