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

describe("parseDuration, written with a fraction", () => {
  it("reads a fractional hour", () => {
    expect(minutes("1.5h")).toBe(90);
    expect(minutes("0.25h")).toBe(15);
  });

  it("reads an hour written with a leading point", () => {
    expect(minutes(".5h")).toBe(30);
  });

  it("reads a trailing point as the whole number", () => {
    expect(minutes("2.h")).toBe(120);
  });

  it("reads a fraction alongside a minutes part", () => {
    expect(minutes("1.5h15m")).toBe(105);
  });

  it("rounds to the whole minute, which is the unit", () => {
    // 0.4 of an hour is 24 minutes exactly; 0.41 is 24.6, and the column has
    // nowhere to put the seconds.
    expect(minutes("0.4h")).toBe(24);
    expect(minutes("0.41h")).toBe(25);
  });

  it("rounds a figure a stopwatch produced", () => {
    expect(minutes("1.2345h")).toBe(74);
  });

  it("rounds the sum rather than each part", () => {
    // Each part is half a minute; rounded separately they are 1 and 1, which
    // is a minute more than the duration somebody worked.
    expect(minutes("0.00833333h0.5m")).toBe(1);
  });

  it("rounds a duration shorter than a minute up to one", () => {
    expect(minutes("0.6m")).toBe(1);
  });

  it("rounds a duration of almost nothing down to nothing", () => {
    // Readable and not loggable: the form has the sentence for zero.
    expect(minutes("0.004h")).toBe(0);
  });
});

describe("parseDuration, given a fraction with no unit", () => {
  it("refuses it rather than guessing the unit", () => {
    expect(parseDuration("1.5")).toEqual({
      ok: false,
      reason: "bare-fraction",
    });
  });

  it("refuses the leading-point and trailing-point spellings too", () => {
    expect(parseDuration(".5").ok).toBe(false);
    expect(parseDuration("2.").ok).toBe(false);
  });

  it("keeps reading a bare whole number as minutes", () => {
    // The ambiguity is the fraction, not the missing unit: `90` has one
    // sensible reading and `1.5` has two.
    expect(minutes("90")).toBe(90);
  });

  it("is answered by either spelling the reader meant", () => {
    expect(minutes("1.5h")).toBe(90);
    expect(minutes("1.5m")).toBe(2);
  });
});

describe("parseDuration, given a comma", () => {
  it("refuses a comma decimal rather than reading it either way", () => {
    // A point would make it 90 minutes; a thousands separator would make it
    // 900. The two readings are a tenfold error apart.
    expect(parseDuration("1,5h")).toEqual({ ok: false, reason: "comma" });
  });

  it("refuses a comma with no unit on it", () => {
    expect(parseDuration("1,5")).toEqual({ ok: false, reason: "comma" });
  });

  it("refuses a comma used as a thousands separator", () => {
    expect(parseDuration("1,500m")).toEqual({ ok: false, reason: "comma" });
  });

  it("reads the point spelling it is pointing the reader at", () => {
    expect(minutes("1.5h")).toBe(90);
  });
});

describe("parseDuration, given a clock reading", () => {
  it("refuses the colon form in its own words", () => {
    // Ninety minutes to one reader, half past one to another — and the
    // estimate field above refuses a colon for the same reason.
    expect(parseDuration("1:30")).toEqual({ ok: false, reason: "clock" });
  });

  it("refuses it however many parts it has", () => {
    expect(parseDuration("0:30").ok).toBe(false);
    expect(parseDuration("1:30:00").ok).toBe(false);
  });

  it("reads the spellings the message offers instead", () => {
    expect(minutes("1h30m")).toBe(90);
    expect(minutes("90")).toBe(90);
  });
});

describe("parseDuration, written in words", () => {
  it("reads the short spellings of the hour", () => {
    expect(minutes("2hr")).toBe(120);
    expect(minutes("2hrs")).toBe(120);
  });

  it("reads the long spellings of the hour", () => {
    expect(minutes("1hour")).toBe(60);
    expect(minutes("2hours")).toBe(120);
  });

  it("reads the short spellings of the minute", () => {
    expect(minutes("45min")).toBe(45);
    expect(minutes("45mins")).toBe(45);
  });

  it("reads the long spellings of the minute", () => {
    expect(minutes("1minute")).toBe(1);
    expect(minutes("45minutes")).toBe(45);
  });

  it("reads the two units spelled differently from each other", () => {
    expect(minutes("1hr 30min")).toBe(90);
    expect(minutes("1 hour 30 m")).toBe(90);
  });

  it("still refuses a unit it does not hold", () => {
    // Minutes are the unit the column holds, so seconds would be rounded into
    // something other than what was typed.
    expect(minutes("90sec")).toBeNull();
    expect(minutes("2days")).toBeNull();
  });

  it("refuses a misspelling it cannot be sure of", () => {
    expect(minutes("2hs")).toBeNull();
    expect(minutes("45mn")).toBeNull();
  });
});
