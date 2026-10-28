import { describe, expect, it } from "vitest";

import {
  EMPTY_START_TIMER_FIELDS,
  parseStartTimerForm,
  readStartTimerDay,
  readStartTimerFields,
  START_TIMER_FIELD_LIMITS,
  START_TIMER_NO_DAY,
  START_TIMER_UNKNOWN_DELIVERABLE,
  STARTED_ON_FIELD,
  type StartTimerFormFields,
} from "./start";

import { BILLABLE_VALUE } from "./form";

/** The day the browser's clock would have filled the hidden field with. */
const TODAY = "2026-10-28";

/** The lines the picker was built from. */
const OFFERED = ["dlv_discovery", "dlv_build"];

function fields(
  overrides: Partial<StartTimerFormFields> = {},
): StartTimerFormFields {
  return { ...EMPTY_START_TIMER_FIELDS, ...overrides };
}

describe("readStartTimerFields", () => {
  it("reads the three fields the form submits", () => {
    const data = new FormData();
    data.set("deliverable", "dlv_build");
    data.set("note", "Pairing on the importer");
    data.set("billable", BILLABLE_VALUE);

    expect(readStartTimerFields(data)).toEqual({
      deliverable: "dlv_build",
      note: "Pairing on the importer",
      billable: BILLABLE_VALUE,
    });
  });

  it("reads an absent field as blank rather than missing", () => {
    expect(readStartTimerFields(new FormData())).toEqual(
      EMPTY_START_TIMER_FIELDS,
    );
  });
});

describe("readStartTimerDay", () => {
  it("reads the hidden date the browser filled in", () => {
    const data = new FormData();
    data.set(STARTED_ON_FIELD, TODAY);

    expect(readStartTimerDay(data)).toBe(TODAY);
  });

  it("is blank when the script never filled it in", () => {
    expect(readStartTimerDay(new FormData())).toBe("");
  });
});

describe("parseStartTimerForm", () => {
  it("accepts a press with nothing filled in", () => {
    const parsed = parseStartTimerForm(fields(), TODAY, OFFERED);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({
      deliverableId: null,
      note: null,
      billable: false,
      startedOn: TODAY,
    });
  });

  it("keeps the line of scope the clock was started against", () => {
    const parsed = parseStartTimerForm(
      fields({ deliverable: "dlv_build" }),
      TODAY,
      OFFERED,
    );
    if (!parsed.ok) throw new Error("the press should have been accepted");

    expect(parsed.value.deliverableId).toBe("dlv_build");
  });

  it("reads a ticked box as chargeable", () => {
    const parsed = parseStartTimerForm(
      fields({ billable: BILLABLE_VALUE }),
      TODAY,
      OFFERED,
    );
    if (!parsed.ok) throw new Error("the press should have been accepted");

    expect(parsed.value.billable).toBe(true);
  });

  it("trims the note and reads a blank one as none", () => {
    const parsed = parseStartTimerForm(fields({ note: "   " }), TODAY, OFFERED);
    if (!parsed.ok) throw new Error("the press should have been accepted");

    expect(parsed.value.note).toBeNull();
  });

  it("refuses a line the project does not have, beside the picker", () => {
    const parsed = parseStartTimerForm(
      fields({ deliverable: "dlv_gone" }),
      TODAY,
      OFFERED,
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.deliverable).toBe(START_TIMER_UNKNOWN_DELIVERABLE);
    expect(parsed.problem).toBeNull();
  });

  it("refuses a note longer than the column takes", () => {
    const parsed = parseStartTimerForm(
      fields({ note: "x".repeat(START_TIMER_FIELD_LIMITS.note + 1) }),
      TODAY,
      OFFERED,
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.note).toBeDefined();
  });

  it("refuses a submission with no day, as a problem with the form", () => {
    const parsed = parseStartTimerForm(fields(), "", OFFERED);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem).toBe(START_TIMER_NO_DAY);
    expect(parsed.errors).toEqual({});
  });

  it("refuses a day with a time of day on it", () => {
    const parsed = parseStartTimerForm(
      fields(),
      "2026-10-28T09:00:00.000Z",
      OFFERED,
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem).toBe(START_TIMER_NO_DAY);
  });

  it("refuses a day that is not a day at all", () => {
    const parsed = parseStartTimerForm(fields(), "2026-02-30", OFFERED);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem).toBe(START_TIMER_NO_DAY);
  });

  it("accepts a day with whitespace around it", () => {
    const parsed = parseStartTimerForm(fields(), `  ${TODAY}  `, OFFERED);
    if (!parsed.ok) throw new Error("the press should have been accepted");

    expect(parsed.value.startedOn).toBe(TODAY);
  });

  it("checks the day before the fields, so a stale page says reload first", () => {
    const parsed = parseStartTimerForm(
      fields({ deliverable: "dlv_gone" }),
      "",
      OFFERED,
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem).toBe(START_TIMER_NO_DAY);
  });

  it("accepts a project with nothing agreed yet", () => {
    const parsed = parseStartTimerForm(fields(), TODAY, []);

    expect(parsed.ok).toBe(true);
  });
});
