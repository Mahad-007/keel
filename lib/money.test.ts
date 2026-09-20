import { describe, expect, it } from "vitest";

import { costOfMinutes, formatCents, parseCents } from "./money";

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
});
