import { describe, expect, it } from "vitest";

import { axisMoneyLabel, compactMoneyLabel } from "./axis";

describe("axisMoneyLabel", () => {
  it("writes a round amount in dollars alone", () => {
    expect(axisMoneyLabel(400_000)).toBe("$4,000");
    expect(axisMoneyLabel(0)).toBe("$0");
  });

  it("separates the thousands the way the figures above it do", () => {
    expect(axisMoneyLabel(1_250_000)).toBe("$12,500");
  });

  it("marks an overrun as money below nothing", () => {
    expect(axisMoneyLabel(-100_000)).toBe("-$1,000");
  });

  it("keeps the cents of a tick that is not whole dollars", () => {
    // Only a very short axis lands here, and rounding would put the label at
    // a figure the gridline beside it is not drawn at.
    expect(axisMoneyLabel(1_250)).toBe("$12.50");
    expect(axisMoneyLabel(7)).toBe("$0.07");
  });
});

describe("compactMoneyLabel", () => {
  it("shortens thousands", () => {
    expect(compactMoneyLabel(1_000_000)).toBe("$10K");
    expect(compactMoneyLabel(5_000_000)).toBe("$50K");
  });

  it("shortens millions", () => {
    expect(compactMoneyLabel(100_000_000)).toBe("$1M");
    expect(compactMoneyLabel(124_000_000)).toBe("$1.2M");
  });

  it("keeps one decimal where a half step needs it", () => {
    expect(compactMoneyLabel(1_250_000)).toBe("$12.5K");
  });

  it("drops a trailing zero rather than printing a column of them", () => {
    expect(compactMoneyLabel(1_000_000)).not.toContain(".0");
  });

  it("writes an overrun below the line with its sign in front", () => {
    expect(compactMoneyLabel(-1_250_000)).toBe("-$12.5K");
    expect(compactMoneyLabel(-100_000_000)).toBe("-$1M");
  });

  it("leaves an amount under a thousand dollars written out", () => {
    expect(compactMoneyLabel(0)).toBe("$0");
    expect(compactMoneyLabel(50_000)).toBe("$500");
    expect(compactMoneyLabel(99_900)).toBe("$999");
  });

  it("switches units exactly at a thousand and at a million", () => {
    expect(compactMoneyLabel(99_999)).toBe("$999.99");
    expect(compactMoneyLabel(100_000)).toBe("$1K");
    expect(compactMoneyLabel(99_999_999)).toBe("$1000K");
    expect(compactMoneyLabel(100_000_000)).toBe("$1M");
  });
});
