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
