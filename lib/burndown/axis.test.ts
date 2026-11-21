import { describe, expect, it } from "vitest";

import {
  axisMoneyLabel,
  compactMoneyLabel,
  moneyTickStep,
} from "./axis";

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

describe("moneyTickStep", () => {
  it("steps a five-thousand-dollar contract in thousands", () => {
    expect(moneyTickStep(500_000)).toBe(100_000);
  });

  it("steps an awkward contract in round figures anyway", () => {
    // $4,250 over four gaps is $1,062.50 a gap, which nobody says out loud.
    expect(moneyTickStep(425_000)).toBe(100_000);
  });

  it("takes an extra gridline over an axis labelled in odd figures", () => {
    for (const span of [500_000, 425_000, 1_234_567, 9_900, 80_000_000]) {
      const gaps = span / moneyTickStep(span);
      expect(gaps).toBeGreaterThan(2);
      expect(gaps).toBeLessThanOrEqual(7);
    }
  });

  it("only ever steps in one, two or five times a power of ten", () => {
    for (const span of [1, 99, 500_000, 425_000, 1_234_567, 80_000_000]) {
      const step = moneyTickStep(span);
      const magnitude = 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5, 10]).toContain(step / magnitude);
    }
  });

  it("rounds to the nearest round step rather than always upwards", () => {
    // A quarter of this range is $1,100, which is nearer $1,000 than $2,000.
    expect(moneyTickStep(440_000)).toBe(100_000);
    // A quarter of this one is $1,900, which is nearer $2,000.
    expect(moneyTickStep(760_000)).toBe(200_000);
  });

  it("never steps by less than a cent", () => {
    expect(moneyTickStep(1)).toBe(1);
    expect(moneyTickStep(3)).toBe(1);
  });

  it("gives a range of nothing a step that can still be divided by", () => {
    expect(moneyTickStep(0)).toBe(1);
    expect(moneyTickStep(-500_000)).toBe(1);
  });
});
