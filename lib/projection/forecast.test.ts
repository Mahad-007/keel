import { describe, expect, it } from "vitest";

import type { EffectiveRate } from "@/lib/rates";

import { remainingWorkCents } from "./forecast";

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
