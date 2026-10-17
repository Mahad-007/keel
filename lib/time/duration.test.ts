import { describe, expect, it } from "vitest";

import { parseDuration } from "./duration";

/** The minutes a readable duration came to, for the ordinary assertion. */
function minutes(input: string): number | null {
  const parsed = parseDuration(input);
  return parsed.ok ? parsed.minutes : null;
}

describe("parseDuration", () => {
  describe("a bare number", () => {
    it("reads as minutes", () => {
      expect(minutes("90")).toBe(90);
      expect(minutes("45")).toBe(45);
    });

    it("reads a figure larger than an hour as minutes, not hours", () => {
      // The convention the field is built on: a timer reads in minutes, and
      // 150 of them is two and a half hours rather than six days.
      expect(minutes("150")).toBe(150);
    });

    it("ignores the spaces around it", () => {
      expect(minutes("  90  ")).toBe(90);
    });

    it("reads a single minute", () => {
      expect(minutes("1")).toBe(1);
    });

    it("reads zero, which the form refuses in its own words", () => {
      // Zero is readable and not loggable. Saying so is the form's job, which
      // is why the parser hands it back rather than refusing it here.
      expect(minutes("0")).toBe(0);
    });
  });

  describe("what it cannot read", () => {
    it("refuses words", () => {
      expect(parseDuration("an hour")).toEqual({
        ok: false,
        reason: "unreadable",
      });
    });

    it("refuses a number with something stuck to it", () => {
      expect(minutes("90x")).toBeNull();
      expect(minutes("~90")).toBeNull();
    });
  });
});

describe("parseDuration, with nothing typed", () => {
  it("reports a blank field as blank rather than unreadable", () => {
    expect(parseDuration("")).toEqual({ ok: false, reason: "blank" });
  });

  it("counts a field holding only spaces as blank", () => {
    expect(parseDuration("   ")).toEqual({ ok: false, reason: "blank" });
  });
});

describe("parseDuration, written in hours and minutes", () => {
  it("reads both parts", () => {
    expect(minutes("1h30m")).toBe(90);
    expect(minutes("2h15m")).toBe(135);
  });

  it("reads hours alone", () => {
    expect(minutes("2h")).toBe(120);
  });

  it("reads minutes alone", () => {
    expect(minutes("45m")).toBe(45);
  });

  it("does not mind the space between the parts", () => {
    expect(minutes("1h 30m")).toBe(90);
    expect(minutes("1 h 30 m")).toBe(90);
  });

  it("does not mind the case", () => {
    expect(minutes("1H30M")).toBe(90);
  });

  it("adds a minutes part that runs past the hour", () => {
    // Nothing is gained by refusing it: somebody who worked an hour and
    // ninety minutes has said what they mean, and it is 150 minutes.
    expect(minutes("1h90m")).toBe(150);
  });

  it("reads a long day", () => {
    expect(minutes("12h")).toBe(720);
  });

  it("refuses the parts in the wrong order", () => {
    // `30m1h` is not something anybody says, and guessing at it would mean
    // guessing at `1m30h` too.
    expect(minutes("30m1h")).toBeNull();
  });

  it("refuses a unit with no number in front of it", () => {
    expect(minutes("h")).toBeNull();
    expect(minutes("h30m")).toBeNull();
  });

  it("refuses a repeated part", () => {
    expect(minutes("1h1h")).toBeNull();
    expect(minutes("30m30m")).toBeNull();
  });

  it("refuses a unit it has never heard of", () => {
    expect(minutes("90s")).toBeNull();
    expect(minutes("2d")).toBeNull();
  });
});
