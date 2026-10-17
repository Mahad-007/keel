import { describe, expect, it } from "vitest";

import {
  DURATION_MESSAGES,
  loggedMinutes,
  MAX_ENTRY_MINUTES,
  workedOnDate,
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
