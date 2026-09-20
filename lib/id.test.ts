import { describe, expect, it, vi } from "vitest";

import { newId } from "./id";

describe("newId", () => {
  it("prefixes the id when asked", () => {
    expect(newId("cli")).toMatch(/^cli_[0-9a-z]{20}$/);
    expect(newId()).toMatch(/^[0-9a-z]{20}$/);
  });

  it("rejects a prefix that would make the id ambiguous", () => {
    expect(() => newId("cli_")).toThrow();
    expect(() => newId("Client")).toThrow();
    expect(() => newId("")).toThrow();
  });

  it("does not repeat itself, even inside the same millisecond", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId("cli")));
    expect(ids.size).toBe(10_000);
  });

  it("sorts by creation time", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_700_000_000_000);
    const earlier = newId("cli");
    now.mockReturnValue(1_700_000_001_000);
    const later = newId("cli");
    now.mockRestore();

    expect(earlier < later).toBe(true);
  });
});
