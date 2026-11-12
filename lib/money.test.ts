import { describe, expect, it } from "vitest";

import {
  centsToInput,
  costOfMinutes,
  formatCents,
  parseCents,
  withoutNegativeZero,
} from "./money";

describe("formatCents", () => {
  it("renders whole and partial dollars", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-500)).toBe("-$5.00");
  });
});

describe("parseCents", () => {
  it("accepts the shapes people actually type", () => {
    expect(parseCents("1234.56")).toBe(123456);
    expect(parseCents("$1,234.56")).toBe(123456);
    expect(parseCents(" 80 ")).toBe(8000);
  });

  it("rejects anything that is not an amount", () => {
    expect(() => parseCents("")).toThrow();
    expect(() => parseCents("abc")).toThrow();
    expect(() => parseCents("1.234")).toThrow();
  });
});

describe("costOfMinutes", () => {
  it("bills partial hours at the cent", () => {
    expect(costOfMinutes(60, 10000)).toBe(10000);
    expect(costOfMinutes(30, 10000)).toBe(5000);
    expect(costOfMinutes(20, 10000)).toBe(3333);
  });

  it("keeps the sign off an amount that rounds away to nothing", () => {
    expect(Object.is(costOfMinutes(-30, 0), 0)).toBe(true);
    expect(Object.is(costOfMinutes(-1, 1), 0)).toBe(true);
    expect(formatCents(costOfMinutes(-1, 1))).toBe("$0.00");
  });

  it("still carries a loss big enough to show", () => {
    expect(costOfMinutes(-60, 10000)).toBe(-10000);
  });

  it("rounds an exact half cent up rather than a hair down", () => {
    expect(costOfMinutes(11, 1350)).toBe(248);
    expect(costOfMinutes(21, 1450)).toBe(508);
  });
});

describe("centsToInput", () => {
  it("writes two decimal places with no symbol or separators", () => {
    expect(centsToInput(123456)).toBe("1234.56");
    expect(centsToInput(15000)).toBe("150.00");
    expect(centsToInput(5)).toBe("0.05");
    expect(centsToInput(0)).toBe("0.00");
  });

  it("round-trips through parseCents", () => {
    for (const cents of [0, 1, 99, 100, 15000, 1_000_000, 123456]) {
      expect(parseCents(centsToInput(cents))).toBe(cents);
    }
  });

  it("keeps a negative amount negative", () => {
    expect(centsToInput(-150)).toBe("-1.50");
    expect(parseCents(centsToInput(-150))).toBe(-150);
  });

  it("refuses a fractional cent rather than rounding it away", () => {
    expect(() => centsToInput(100.5)).toThrow(/whole number of cents/);
  });
});

describe("withoutNegativeZero", () => {
  it("turns minus zero into zero and leaves everything else alone", () => {
    expect(Object.is(withoutNegativeZero(-0), 0)).toBe(true);
    expect(Object.is(withoutNegativeZero(0), 0)).toBe(true);
    expect(withoutNegativeZero(-250)).toBe(-250);
    expect(withoutNegativeZero(250)).toBe(250);
  });

  it("stops a rounded-away loss printing as a negative amount", () => {
    expect(formatCents(-0)).toBe("-$0.00");
    expect(formatCents(withoutNegativeZero(-0))).toBe("$0.00");
  });
});
