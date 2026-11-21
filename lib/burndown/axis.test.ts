import { describe, expect, it } from "vitest";

import { axisMoneyLabel } from "./axis";

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
