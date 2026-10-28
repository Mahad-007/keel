import { describe, expect, it } from "vitest";

import { elapsedMinutes } from "./timer";

/** A fixed start, so every case below is arithmetic rather than a race. */
const STARTED = "2026-10-28T09:00:00.000Z";

/** `STARTED` plus a number of seconds, as the clock would read it. */
function after(seconds: number): Date {
  return new Date(Date.parse(STARTED) + seconds * 1_000);
}

describe("elapsedMinutes", () => {
  it("is zero for a timer started this instant", () => {
    expect(elapsedMinutes(STARTED, after(0))).toBe(0);
  });

  it("stays at zero until a whole minute has passed", () => {
    expect(elapsedMinutes(STARTED, after(59))).toBe(0);
  });

  it("reads one minute at sixty seconds", () => {
    expect(elapsedMinutes(STARTED, after(60))).toBe(1);
  });

  it("floors a part-minute rather than rounding it up", () => {
    expect(elapsedMinutes(STARTED, after(119))).toBe(1);
  });

  it("counts an hour and a half as ninety minutes", () => {
    expect(elapsedMinutes(STARTED, after(90 * 60))).toBe(90);
  });

  it("keeps counting past a day", () => {
    expect(elapsedMinutes(STARTED, after(26 * 60 * 60))).toBe(26 * 60);
  });
});

/**
 * The cases where the clock and the row disagree. None of them should happen,
 * and each has one reading that keeps a page renderable: a timer that says no
 * time has passed is visibly wrong, where `NaN` or a negative travels into
 * every figure derived from it.
 */
describe("elapsedMinutes on a clock that cannot be believed", () => {
  it("reads zero when the start is in the future", () => {
    expect(elapsedMinutes(STARTED, after(-600))).toBe(0);
  });

  it("reads zero rather than NaN for a start that is not a timestamp", () => {
    expect(elapsedMinutes("whenever", after(3_600))).toBe(0);
  });

  it("reads zero for a blank start", () => {
    expect(elapsedMinutes("", after(3_600))).toBe(0);
  });

  it("reads zero when the clock itself is not a moment", () => {
    expect(elapsedMinutes(STARTED, new Date(Number.NaN))).toBe(0);
  });
});
