import { describe, expect, it } from "vitest";

import { formatMinutes, hoursInput, parseHours } from "./minutes";

describe("formatMinutes", () => {
  it("writes under an hour as minutes alone", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(1)).toBe("1m");
  });

  it("writes a whole number of hours without a minutes part", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(480)).toBe("8h");
  });

  it("writes both parts when there is a remainder", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(605)).toBe("10h 5m");
  });

  it("writes nothing logged as zero minutes, not as blank", () => {
    expect(formatMinutes(0)).toBe("0m");
  });

  it("keeps the sign on a negative duration", () => {
    expect(formatMinutes(-90)).toBe("-1h 30m");
    expect(formatMinutes(-5)).toBe("-5m");
  });

  it("rounds a fractional value rather than refusing to render it", () => {
    expect(formatMinutes(90.4)).toBe("1h 30m");
    expect(formatMinutes(59.6)).toBe("1h");
  });
});

describe("parseHours", () => {
  it("reads a whole number of hours", () => {
    expect(parseHours("2")).toBe(120);
    expect(parseHours("0")).toBe(0);
  });

  it("reads a decimal fraction of an hour", () => {
    expect(parseHours("1.5")).toBe(90);
    expect(parseHours("0.25")).toBe(15);
  });

  it("reads a leading point, which is how half an hour gets typed", () => {
    expect(parseHours(".5")).toBe(30);
  });

  it("ignores the whitespace a pasted figure carries", () => {
    expect(parseHours("  2.5 ")).toBe(150);
    expect(parseHours("1 0")).toBe(600);
  });

  it("refuses a comma rather than reading 1,5 as fifteen hours", () => {
    expect(() => parseHours("1,5")).toThrow("not a number of hours");
  });

  it("rounds to the minute rather than storing seconds", () => {
    expect(parseHours("1.004")).toBe(60);
    expect(parseHours("0.009")).toBe(1);
  });

  it("keeps a negative, leaving the range check to the caller", () => {
    expect(parseHours("-1.5")).toBe(-90);
  });

  it("refuses anything that is not a number of hours", () => {
    expect(() => parseHours("")).toThrow("not a number of hours");
    expect(() => parseHours("two")).toThrow("not a number of hours");
    expect(() => parseHours("1:30")).toThrow("not a number of hours");
    expect(() => parseHours("1h")).toThrow("not a number of hours");
  });
});

describe("hoursInput", () => {
  it("writes whole hours without a decimal part", () => {
    expect(hoursInput(60)).toBe("1");
    expect(hoursInput(120)).toBe("2");
    expect(hoursInput(1_200)).toBe("20");
  });

  it("writes a half hour the way somebody would type it", () => {
    expect(hoursInput(90)).toBe("1.5");
    expect(hoursInput(30)).toBe("0.5");
    expect(hoursInput(15)).toBe("0.25");
  });

  it("writes an unestimated line as a zero, not a blank", () => {
    // Whether a zero belongs in the box at all is the form layer's question.
    expect(hoursInput(0)).toBe("0");
  });

  it("round-trips every minute value, so an untouched save writes it back", () => {
    // The thirds are the hard ones: 20 minutes is 0.3333 hours, and a form that
    // lost a minute each time a deliverable was opened would be worse than one
    // that refused to open it.
    for (let minutes = 0; minutes <= 600; minutes += 1) {
      expect(parseHours(hoursInput(minutes))).toBe(minutes);
    }
  });

  it("round-trips the largest estimate a scope line can hold", () => {
    expect(parseHours(hoursInput(60_000))).toBe(60_000);
  });

  it("keeps a negative, which only a hand-edited row can hold", () => {
    expect(hoursInput(-90)).toBe("-1.5");
  });
});
