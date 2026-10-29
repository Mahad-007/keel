import { describe, expect, it } from "vitest";

import {
  EMPTY_START_TIMER_FIELDS,
  failedStartTimerState,
  INITIAL_START_TIMER_STATE,
  parseStartTimerForm,
  readStartTimerDay,
  readStartTimerFields,
  START_TIMER_FIELD_LIMITS,
  START_TIMER_NO_DAY,
  START_TIMER_PROBLEMS,
  START_TIMER_UNKNOWN_DELIVERABLE,
  STARTED_ON_FIELD,
  startedTimerNotice,
  startedTimerState,
  rejectedStartTimerState,
  timerAlreadyRunning,
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

describe("INITIAL_START_TIMER_STATE", () => {
  it("starts with the chargeable box ticked", () => {
    expect(INITIAL_START_TIMER_STATE.fields.billable).toBe(BILLABLE_VALUE);
  });

  it("has nothing running and nothing wrong", () => {
    expect(INITIAL_START_TIMER_STATE.started).toBeNull();
    expect(INITIAL_START_TIMER_STATE.formError).toBeNull();
    expect(INITIAL_START_TIMER_STATE.errors).toEqual({});
  });
});

describe("startedTimerState", () => {
  it("carries what was started and clears the form behind it", () => {
    const state = startedTimerState({
      id: "tmr_one",
      deliverableTitle: "Importer",
      billable: true,
    });

    expect(state.started).toMatchObject({ id: "tmr_one" });
    expect(state.fields).toEqual(INITIAL_START_TIMER_STATE.fields);
  });
});

describe("rejectedStartTimerState", () => {
  it("echoes what was submitted and reports no clock", () => {
    const state = rejectedStartTimerState(fields({ note: "Pairing" }), {
      deliverable: START_TIMER_UNKNOWN_DELIVERABLE,
    });

    expect(state.fields.note).toBe("Pairing");
    expect(state.errors.deliverable).toBe(START_TIMER_UNKNOWN_DELIVERABLE);
    expect(state.started).toBeNull();
  });
});

describe("failedStartTimerState", () => {
  it("puts the sentence on the form rather than on a field", () => {
    const state = failedStartTimerState(
      fields(),
      START_TIMER_PROBLEMS.missingProject,
    );

    expect(state.formError).toBe(START_TIMER_PROBLEMS.missingProject);
    expect(state.errors).toEqual({});
    expect(state.started).toBeNull();
  });
});

describe("timerAlreadyRunning", () => {
  it("names the project the clock is on", () => {
    expect(timerAlreadyRunning("Brand refresh")).toContain("Brand refresh");
  });

  it("says to stop that one rather than offering to do it", () => {
    expect(timerAlreadyRunning("Brand refresh")).toContain("Stop that one");
  });
});

describe("startedTimerNotice", () => {
  it("names the line the clock is running against", () => {
    const notice = startedTimerNotice({
      id: "tmr_one",
      deliverableTitle: "Importer",
      billable: true,
    });

    expect(notice).toBe("The clock is running against “Importer”.");
  });

  it("calls unattributed work the project itself", () => {
    const notice = startedTimerNotice({
      id: "tmr_one",
      deliverableTitle: null,
      billable: true,
    });

    expect(notice).toBe("The clock is running against the project itself.");
  });

  it("says so when the clock will not be charged for", () => {
    const notice = startedTimerNotice({
      id: "tmr_one",
      deliverableTitle: "Importer",
      billable: false,
    });

    expect(notice).toContain("Marked as not chargeable.");
  });
});
