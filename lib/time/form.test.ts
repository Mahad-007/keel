import { describe, expect, it } from "vitest";

import {
  BILLABLE_VALUE,
  DURATION_MESSAGES,
  EMPTY_LOG_TIME_FIELDS,
  failedLogTimeState,
  INITIAL_LOG_TIME_STATE,
  LOG_TIME_FIELD_LIMITS,
  loggedTimeNotice,
  loggedTimeState,
  loggedMinutes,
  MAX_ENTRY_MINUTES,
  parseLogTimeForm,
  readsAsBillable,
  rejectedLogTimeState,
  workedOnDate,
  type LoggedTime,
  type LogTimeFormFields,
} from "./form";

/** The message a refused field came back with, for the ordinary assertion. */
function refusal(value: string): string | null {
  const result = loggedMinutes(value);
  return result.ok ? null : result.message;
}

describe("loggedMinutes", () => {
  it("accepts a duration in either spelling the hint offers", () => {
    expect(loggedMinutes("1h30m")).toEqual({ ok: true, value: 90 });
    expect(loggedMinutes("90")).toEqual({ ok: true, value: 90 });
  });

  it("accepts a whole working day", () => {
    expect(loggedMinutes("8h")).toEqual({ ok: true, value: 480 });
  });

  it("accepts a single minute", () => {
    expect(loggedMinutes("1m")).toEqual({ ok: true, value: 1 });
  });

  it("accepts the longest entry there can be", () => {
    expect(loggedMinutes("24h")).toEqual({
      ok: true,
      value: MAX_ENTRY_MINUTES,
    });
  });

  describe("what it says about a duration it cannot read", () => {
    it("asks for one when the field is blank", () => {
      expect(refusal("")).toBe(DURATION_MESSAGES.blank);
    });

    it("names both readings of a bare fraction", () => {
      expect(refusal("1.5")).toBe(DURATION_MESSAGES["bare-fraction"]);
    });

    it("points at the decimal point when a comma was typed", () => {
      expect(refusal("1,5h")).toBe(DURATION_MESSAGES.comma);
    });

    it("distinguishes a duration from a clock reading", () => {
      expect(refusal("1:30")).toBe(DURATION_MESSAGES.clock);
    });

    it("says what the field takes when nothing else fits", () => {
      expect(refusal("ages")).toBe(DURATION_MESSAGES.unreadable);
    });

    it("offers a spelling that works in every one of them", () => {
      // The message is the only place the syntax is written down, so a
      // refusal that does not carry an example is a dead end.
      for (const message of Object.values(DURATION_MESSAGES)) {
        expect(message).toMatch(/1h30m|45m|90|1\.5h/);
      }
    });
  });

  describe("what it says about a duration it read", () => {
    it("refuses a negative in its own words", () => {
      // Not a spelling mistake: a minus sign is a slip, and telling somebody
      // their duration is unreadable would send them to fix the spelling.
      expect(refusal("-30")).toMatch(/cannot be negative/);
    });

    it("refuses zero", () => {
      expect(refusal("0")).toMatch(/at least a minute/);
    });

    it("refuses a figure that rounds away to nothing", () => {
      expect(refusal("0.001h")).toMatch(/at least a minute/);
    });

    it("refuses more than a day, which is the typo that matters", () => {
      // `40h` for `40m` is the slip this catches: sixty times too big, and
      // every burn figure derived from it would be wrong.
      expect(refusal("40h")).toMatch(/cannot be longer than 24 hours/);
    });

    it("refuses a day and a minute", () => {
      expect(refusal("24h1m")).toMatch(/cannot be longer than 24 hours/);
    });

    it("refuses a figure too large to be a number at all", () => {
      expect(refusal(`${"9".repeat(400)}h`)).toMatch(
        /cannot be longer than 24 hours/,
      );
    });
  });
});

describe("workedOnDate", () => {
  it("accepts the day a date input submits", () => {
    expect(workedOnDate("2026-10-17")).toEqual({
      ok: true,
      value: "2026-10-17",
    });
  });

  it("trims the day before storing it", () => {
    expect(workedOnDate(" 2026-10-17 ")).toEqual({
      ok: true,
      value: "2026-10-17",
    });
  });

  it("asks for a day when the field is empty", () => {
    expect(workedOnDate("")).toEqual({
      ok: false,
      message: "Say which day the work was done on.",
    });
  });

  it("counts a day of only spaces as empty", () => {
    expect(workedOnDate("   ").ok).toBe(false);
  });

  it("refuses a timestamp, which would file the work under UTC's day", () => {
    expect(workedOnDate("2026-10-17T09:36:00.000Z").ok).toBe(false);
  });

  it("refuses a day that does not exist", () => {
    expect(workedOnDate("2026-02-30").ok).toBe(false);
  });

  it("refuses a date written any other way round", () => {
    expect(workedOnDate("17/10/2026").ok).toBe(false);
  });

  it("accepts a day in the future rather than second-guessing it", () => {
    // Readable, and somebody could mean it. An entry that looks implausible
    // is better flagged against the ones around it than refused here.
    expect(workedOnDate("2099-01-01").ok).toBe(true);
  });
});

describe("readsAsBillable", () => {
  it("reads the ticked box as chargeable", () => {
    expect(readsAsBillable(BILLABLE_VALUE)).toBe(true);
  });

  it("reads an absent field as not chargeable", () => {
    // Which is how a browser submits an unticked checkbox: it sends nothing,
    // and `readFields` turns nothing into a blank string.
    expect(readsAsBillable("")).toBe(false);
  });

  it("reads anything else as not chargeable", () => {
    // Including the words that look like a yes. Billing an hour somebody
    // marked non-chargeable is the mistake the column exists to prevent, so
    // the only value that bills is the one the form sends.
    expect(readsAsBillable("on")).toBe(false);
    expect(readsAsBillable("true")).toBe(false);
    expect(readsAsBillable("false")).toBe(false);
    expect(readsAsBillable("1")).toBe(false);
  });
});

describe("parseLogTimeForm", () => {
  const OFFERED = ["dlv_wireframes", "dlv_build"];

  function fields(
    overrides: Partial<Record<string, string>> = {},
  ): LogTimeFormFields {
    return {
      ...EMPTY_LOG_TIME_FIELDS,
      duration: "1h30m",
      workedOn: "2026-10-17",
      billable: BILLABLE_VALUE,
      ...overrides,
    };
  }

  it("yields the columns a time entry is made of", () => {
    const parsed = parseLogTimeForm(
      fields({ deliverable: "dlv_build", note: "Paired on the booking flow" }),
      OFFERED,
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        minutes: 90,
        workedOn: "2026-10-17",
        deliverableId: "dlv_build",
        note: "Paired on the booking flow",
        billable: true,
      },
    });
  });

  it("logs against the project itself when no line was picked", () => {
    const parsed = parseLogTimeForm(fields(), OFFERED);

    expect(parsed.ok && parsed.value.deliverableId).toBeNull();
  });

  it("stores a blank note as nothing rather than as an empty string", () => {
    const parsed = parseLogTimeForm(fields({ note: "   " }), OFFERED);

    expect(parsed.ok && parsed.value.note).toBeNull();
  });

  it("trims a note before storing it", () => {
    const parsed = parseLogTimeForm(fields({ note: "  Invoicing  " }), OFFERED);

    expect(parsed.ok && parsed.value.note).toBe("Invoicing");
  });

  it("marks the time non-chargeable when the box is unticked", () => {
    const parsed = parseLogTimeForm(fields({ billable: "" }), OFFERED);

    expect(parsed.ok && parsed.value.billable).toBe(false);
  });

  it("reports every bad field at once", () => {
    const parsed = parseLogTimeForm(
      fields({ duration: "ages", workedOn: "", note: "x".repeat(501) }),
      OFFERED,
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && Object.keys(parsed.errors).sort()).toEqual([
      "duration",
      "note",
      "workedOn",
    ]);
  });

  it("refuses a deliverable that is not on the project", () => {
    const parsed = parseLogTimeForm(
      fields({ deliverable: "dlv_elsewhere" }),
      OFFERED,
    );

    expect(parsed.ok === false && parsed.errors.deliverable).toMatch(
      /no longer on this project/,
    );
  });

  it("refuses any attribution on a project with no scope", () => {
    const parsed = parseLogTimeForm(fields({ deliverable: "dlv_build" }), []);

    expect(parsed.ok).toBe(false);
  });

  it("accepts a note at the limit and refuses one past it", () => {
    const limit = LOG_TIME_FIELD_LIMITS.note;
    expect(
      parseLogTimeForm(fields({ note: "x".repeat(limit) }), OFFERED).ok,
    ).toBe(true);
    expect(
      parseLogTimeForm(fields({ note: "x".repeat(limit + 1) }), OFFERED).ok,
    ).toBe(false);
  });

  it("never blames the checkbox for anything", () => {
    // It submits one of two values and both are answers, so there is no
    // message that could ever appear under it.
    const parsed = parseLogTimeForm(
      fields({ duration: "", billable: "nonsense" }),
      OFFERED,
    );

    expect(parsed.ok === false && "billable" in parsed.errors).toBe(false);
  });
});

const LOGGED: LoggedTime = {
  id: "tme_1",
  minutes: 90,
  workedOn: "2026-10-17",
  deliverableTitle: "Wireframes",
  billable: true,
};

describe("INITIAL_LOG_TIME_STATE", () => {
  it("starts with the chargeable box ticked", () => {
    // Which is what the column defaults to: time logged against a client
    // engagement is chargeable until somebody says otherwise.
    expect(readsAsBillable(INITIAL_LOG_TIME_STATE.fields.billable)).toBe(true);
  });

  it("leaves the day for the browser to fill in", () => {
    // The server does not know what today is where the reader is standing.
    expect(INITIAL_LOG_TIME_STATE.fields.workedOn).toBe("");
  });

  it("has nothing logged and nothing wrong", () => {
    expect(INITIAL_LOG_TIME_STATE.logged).toBeNull();
    expect(INITIAL_LOG_TIME_STATE.errors).toEqual({});
    expect(INITIAL_LOG_TIME_STATE.formError).toBeNull();
  });
});

describe("loggedTimeState", () => {
  it("keeps the day, so the next entry on it needs no date", () => {
    expect(loggedTimeState(LOGGED).fields.workedOn).toBe("2026-10-17");
  });

  it("empties the duration, so the same hour cannot be logged twice", () => {
    expect(loggedTimeState(LOGGED).fields.duration).toBe("");
  });

  it("drops the attribution, so the next entry does not inherit it", () => {
    expect(loggedTimeState(LOGGED).fields.deliverable).toBe("");
  });

  it("empties the note", () => {
    expect(loggedTimeState(LOGGED).fields.note).toBe("");
  });

  it("puts the chargeable box back, however the last entry was marked", () => {
    // One non-chargeable entry should not make the rest of the evening free.
    const state = loggedTimeState({ ...LOGGED, billable: false });

    expect(readsAsBillable(state.fields.billable)).toBe(true);
  });

  it("carries what was written, for the sentence that follows", () => {
    expect(loggedTimeState(LOGGED).logged).toEqual(LOGGED);
  });

  it("has nothing wrong with it", () => {
    expect(loggedTimeState(LOGGED).errors).toEqual({});
    expect(loggedTimeState(LOGGED).formError).toBeNull();
  });
});

describe("rejectedLogTimeState", () => {
  it("echoes what was typed, so a refusal loses nothing", () => {
    const typed = { ...EMPTY_LOG_TIME_FIELDS, duration: "ages", note: "Calls" };
    const state = rejectedLogTimeState(typed, { duration: "No." });

    expect(state.fields).toEqual(typed);
    expect(state.errors).toEqual({ duration: "No." });
    expect(state.logged).toBeNull();
  });
});

describe("failedLogTimeState", () => {
  it("says what happened to the submission as a whole", () => {
    const typed = { ...EMPTY_LOG_TIME_FIELDS, duration: "90" };
    const state = failedLogTimeState(typed, "Nothing was written.");

    expect(state.fields).toEqual(typed);
    expect(state.formError).toBe("Nothing was written.");
    expect(state.errors).toEqual({});
    expect(state.logged).toBeNull();
  });
});

describe("loggedTimeNotice", () => {
  function notice(logged: Partial<typeof LOGGED> = {}) {
    return loggedTimeNotice(loggedTimeState({ ...LOGGED, ...logged }));
  }

  it("says nothing before anything has been logged", () => {
    expect(loggedTimeNotice(INITIAL_LOG_TIME_STATE)).toBeNull();
  });

  it("names the duration, the day and the line", () => {
    expect(notice()).toBe(
      "Logged 1h 30m on Oct 17, 2026 against “Wireframes”.",
    );
  });

  it("reads the duration back as the column holds it", () => {
    // Somebody who typed `90` is told they logged 1h 30m, which is the only
    // confirmation that the bare-number convention did what they meant.
    expect(notice({ minutes: 90 })).toContain("1h 30m");
    expect(notice({ minutes: 45 })).toContain("45m");
    expect(notice({ minutes: 120 })).toContain("2h");
  });

  it("says so when the time went against the project itself", () => {
    // The picker resets after every entry, so this is the thing a reader most
    // often discovers one entry too late.
    expect(notice({ deliverableTitle: null })).toBe(
      "Logged 1h 30m on Oct 17, 2026 against the project itself.",
    );
  });

  it("says when an entry is not chargeable", () => {
    expect(notice({ billable: false })).toBe(
      "Logged 1h 30m on Oct 17, 2026 against “Wireframes”. Marked as not chargeable.",
    );
  });

  it("says nothing about chargeability when it is chargeable", () => {
    // Which is almost every entry, and a sentence repeated after every one of
    // them is a sentence nobody reads.
    expect(notice({ billable: true })).not.toContain("chargeable");
  });

  it("writes the day the way the rest of the app writes dates", () => {
    expect(notice({ workedOn: "2026-01-05" })).toContain("Jan 5, 2026");
  });
});
