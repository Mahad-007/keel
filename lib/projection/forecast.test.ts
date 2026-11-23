import { describe, expect, it } from "vitest";

import type { EffectiveRate } from "@/lib/rates";

import { daysToBurn, remainingWorkCents } from "./forecast";

/** $120.00 an hour, set on the project. */
const RATE: EffectiveRate = { cents: 12_000, source: "project" };

describe("remainingWorkCents", () => {
  it("values the unfinished estimates at the project's rate", () => {
    // Ten hours still to do at $120.00 an hour.
    expect(remainingWorkCents(600, RATE)).toBe(120_000);
  });

  it("rounds the part-hour the way an invoice line would", () => {
    expect(remainingWorkCents(80, RATE)).toBe(16_000);
    expect(remainingWorkCents(1, RATE)).toBe(200);
  });

  it("is nothing when there is no work left", () => {
    expect(remainingWorkCents(0, RATE)).toBe(0);
  });

  it("is nothing when the rate cannot value anything", () => {
    expect(remainingWorkCents(600, { cents: 0, source: "none" })).toBe(0);
  });

  it("carries a hand-edited negative estimate through rather than clamping", () => {
    expect(remainingWorkCents(-600, RATE)).toBe(-120_000);
  });

  it("is handed the total rather than valuing each line in turn", () => {
    // Three twenty-minute lines at $100.00 an hour come to an hour, not to
    // the cent less that valuing each of them separately would give.
    const hourly: EffectiveRate = { cents: 10_000, source: "project" };
    expect(remainingWorkCents(60, hourly)).toBe(10_000);
    expect(remainingWorkCents(20, hourly) * 3).toBe(9_999);
  });
});

describe("daysToBurn", () => {
  it("divides the amount by the pace", () => {
    expect(daysToBurn(70_000, 10_000)).toBe(7);
  });

  it("rounds a part day up", () => {
    // A date rounded down would arrive a day before the money ran out.
    expect(daysToBurn(70_001, 10_000)).toBe(8);
    expect(daysToBurn(1, 10_000)).toBe(1);
  });

  it("is today for an amount of nothing", () => {
    // A project with no work left finishes now, not at some point in the past.
    expect(daysToBurn(0, 10_000)).toBe(0);
  });

  it("is today for a budget already overspent", () => {
    // It ran out in the past, and the overrun figure says by how much in
    // cents. Counting backwards would date it from a pace that has moved.
    expect(daysToBurn(-50_000, 10_000)).toBe(0);
  });

  it("has no answer at a pace of nothing", () => {
    // Never, not in a very long time — and infinity is not a number of days.
    expect(daysToBurn(70_000, 0)).toBeNull();
  });

  it("has no answer at a pace that runs backwards", () => {
    expect(daysToBurn(70_000, -10_000)).toBeNull();
  });

  it("takes a fractional pace without rounding it first", () => {
    // The pace is a ratio, so it arrives unrounded: $33.33 a day over three
    // days reaches $100.00 on the third.
    expect(daysToBurn(10_000, 10_000 / 3)).toBe(3);
  });
});
