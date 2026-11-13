import { describe, expect, it } from "vitest";

import { remainingContractCents } from "./burn";

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
