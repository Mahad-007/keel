import { describe, expect, it } from "vitest";

import {
  correctedTimeFields,
  correctTimeButtonId,
  correctTimeLabel,
  correctTimeState,
  correctTimeText,
  describeOpenedCorrection,
  offeredCorrection,
  suggestedMinutes,
} from "./correct";
import { editTimeState } from "./edit";
import type { ListedTimeEntry } from "./entry";
import { BILLABLE_VALUE } from "./form";
import { IMPLAUSIBLE_ENTRY_MINUTES } from "./implausible";

describe("the duration a flagged entry would most likely have been", () => {
  it("takes the minus off a negative duration", () => {
    expect(suggestedMinutes({ minutes: -90 })).toBe(90);
  });

  it("reads a whole number of hours as a slipped unit", () => {
    expect(suggestedMinutes({ minutes: 13 * 60 })).toBe(13);
  });

  it("makes no guess at a long stretch with minutes on the end", () => {
    // Nothing in a slipped unit would have produced the ten minutes.
    expect(suggestedMinutes({ minutes: 13 * 60 + 10 })).toBeNull();
  });

  it("makes no guess about an entry nothing is wrong with", () => {
    expect(suggestedMinutes({ minutes: 90 })).toBeNull();
  });

  it("makes no guess at twelve hours, which is not flagged", () => {
    expect(suggestedMinutes({ minutes: IMPLAUSIBLE_ENTRY_MINUTES })).toBeNull();
  });

  it("refuses to offer a figure that would itself be flagged", () => {
    // -13h is a negative entry whose magnitude is still past twelve hours, so
    // pressing the offer would leave the caveat exactly where it was.
    expect(suggestedMinutes({ minutes: -13 * 60 })).toBeNull();
  });

  it("refuses to offer nothing at all", () => {
    expect(suggestedMinutes({ minutes: -0 })).toBeNull();
  });

  it("refuses a slip that would still be a long stretch", () => {
    // 100000 hours divided by sixty is still past the threshold.
    expect(suggestedMinutes({ minutes: 100000 * 60 })).toBeNull();
  });

  it("offers the smallest correction a negative entry can need", () => {
    expect(suggestedMinutes({ minutes: -1 })).toBe(1);
  });

  it("offers thirteen minutes for the first flagged whole hour", () => {
    expect(suggestedMinutes({ minutes: 13 * 60 })).toBe(13);
  });
});

const ENTRY: ListedTimeEntry = {
  id: "tme_1",
  minutes: 13 * 60,
  note: "Launch night",
  workedOn: "2026-10-17",
  deliverableId: "dlv_build",
  billable: true,
  billedInvoiceId: null,
};

describe("the editor's boxes as a correction opens them", () => {
  it("puts the suggested duration in the duration box", () => {
    expect(correctedTimeFields(ENTRY, 13).duration).toBe("13m");
  });

  it("writes it as hours and minutes rather than a bare number", () => {
    expect(correctedTimeFields(ENTRY, 90).duration).toBe("1h 30m");
  });

  it("leaves every other box holding what the row holds", () => {
    const fields = correctedTimeFields(ENTRY, 13);
    expect(fields.workedOn).toBe("2026-10-17");
    expect(fields.note).toBe("Launch night");
    expect(fields.deliverable).toBe("dlv_build");
    expect(fields.billable).toBe(BILLABLE_VALUE);
  });

  it("differs from a plain edit in the duration alone", () => {
    const edited = editTimeState(ENTRY).fields;
    const corrected = correctTimeState(ENTRY, 13).fields;
    expect({ ...corrected, duration: edited.duration }).toEqual(edited);
  });

  it("opens with nothing wrong and nothing saved", () => {
    const state = correctTimeState(ENTRY, 13);
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
    expect(state.saved).toBeNull();
  });
});

describe("the words around the offer", () => {
  it("names the entry in the button's id", () => {
    expect(correctTimeButtonId("tme_1")).toBe("time-tme_1-correct");
  });

  it("puts the figure in what the button says", () => {
    expect(correctTimeText(13)).toBe("Correct it to 13m");
  });

  it("writes an hour and a half readably", () => {
    expect(correctTimeText(90)).toBe("Correct it to 1h 30m");
  });

  it("keeps the visible words at the front of the accessible name", () => {
    // Otherwise somebody driving the page by voice says what they can see and
    // nothing happens — WCAG 2.5.3, and the Day 029 lesson.
    const label = correctTimeLabel("13h on Oct 17, 2026", 13);
    expect(label.startsWith(correctTimeText(13))).toBe(true);
  });

  it("says which row the offer is on", () => {
    expect(correctTimeLabel("13h on Oct 17, 2026", 13)).toContain(
      "13h on Oct 17, 2026",
    );
  });

  it("names both figures in the editor's note", () => {
    const said = describeOpenedCorrection(13 * 60, 13);
    expect(said).toContain("13m");
    expect(said).toContain("13h");
  });

  it("offers typing what it really was as well as saving the guess", () => {
    expect(describeOpenedCorrection(13 * 60, 13)).toContain(
      "type what it really was",
    );
  });
});

describe("the correction a row actually gets offered", () => {
  it("offers the guess on an entry the list can change", () => {
    expect(offeredCorrection(ENTRY)).toBe(13);
  });

  it("offers nothing on an entry an invoice has billed", () => {
    // The caveat stays; the press would only be refused.
    expect(
      offeredCorrection({ ...ENTRY, billedInvoiceId: "inv_1" }),
    ).toBeNull();
  });

  it("offers nothing where there is no guess to make", () => {
    expect(offeredCorrection({ ...ENTRY, minutes: 90 })).toBeNull();
  });
});
