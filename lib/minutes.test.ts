import { describe, expect, it } from "vitest";

import { formatMinutes } from "./minutes";

describe("formatMinutes", () => {
  it("writes under an hour as minutes alone", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(1)).toBe("1m");
  });

  it("writes a whole number of hours without a minutes part", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(480)).toBe("8h");
  });

  it("writes both parts when there is a remainder", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(605)).toBe("10h 5m");
  });

  it("writes nothing logged as zero minutes, not as blank", () => {
    expect(formatMinutes(0)).toBe("0m");
  });

  it("keeps the sign on a negative duration", () => {
    expect(formatMinutes(-90)).toBe("-1h 30m");
    expect(formatMinutes(-5)).toBe("-5m");
  });

  it("rounds a fractional value rather than refusing to render it", () => {
    expect(formatMinutes(90.4)).toBe("1h 30m");
    expect(formatMinutes(59.6)).toBe("1h");
  });
});
