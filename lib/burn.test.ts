import { describe, expect, it } from "vitest";

import {
  consumedShare,
  overspentCents,
  remainingContractCents,
} from "./burn";

describe("remainingContractCents", () => {
  it("takes the burn off the contract value", () => {
    expect(remainingContractCents(500_000, 180_000)).toBe(320_000);
  });

  it("is the whole contract when nothing has been burned", () => {
    expect(remainingContractCents(500_000, 0)).toBe(500_000);
  });

  it("is nothing left when the burn lands exactly on the contract", () => {
    expect(remainingContractCents(500_000, 500_000)).toBe(0);
  });

  it("goes below zero rather than clamping once it is over", () => {
    expect(remainingContractCents(500_000, 840_000)).toBe(-340_000);
  });

  it("reports the whole burn as overspend when no price is set", () => {
    expect(remainingContractCents(0, 120_000)).toBe(-120_000);
  });
});

describe("consumedShare", () => {
  it("is the burn over the contract value", () => {
    expect(consumedShare(500_000, 125_000)).toBe(0.25);
  });

  it("is nothing consumed when nothing has been burned", () => {
    expect(consumedShare(500_000, 0)).toBe(0);
  });

  it("is exactly one when the burn lands on the contract value", () => {
    expect(consumedShare(500_000, 500_000)).toBe(1);
  });

  it("goes past one rather than clamping, which is the point of it", () => {
    expect(consumedShare(500_000, 840_000)).toBe(1.68);
  });

  it("has no share to report when no contract value is set", () => {
    expect(consumedShare(0, 120_000)).toBeNull();
  });

  it("has no share to report when the contract value is below zero", () => {
    expect(consumedShare(-500_000, 120_000)).toBeNull();
  });

  it("leaves the fraction unrounded for the formatter to read", () => {
    expect(consumedShare(300_000, 1_000)).toBeCloseTo(0.003_333, 6);
  });
});

describe("overspentCents", () => {
  it("is how far past the contract value the burn has gone", () => {
    expect(overspentCents(500_000, 840_000)).toBe(340_000);
  });

  it("is nothing while the burn is still inside the contract", () => {
    expect(overspentCents(500_000, 180_000)).toBe(0);
  });

  it("is nothing when the burn lands exactly on the contract", () => {
    expect(overspentCents(500_000, 500_000)).toBe(0);
  });

  it("is one cent over at one cent over, with no rounding to hide it", () => {
    expect(overspentCents(500_000, 500_001)).toBe(1);
  });

  it("reads a burn against no price as entirely overspend", () => {
    expect(overspentCents(0, 120_000)).toBe(120_000);
  });
});
