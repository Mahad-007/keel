import { describe, expect, it } from "vitest";

import { timeEntryFormFields } from "./edit";
import type { ListedTimeEntry } from "./entry";
import { parseLogTimeForm, readsAsBillable } from "./form";

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
