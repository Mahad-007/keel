import { describe, expect, it } from "vitest";

import { nextSortOrder } from "./order";

describe("nextSortOrder", () => {
  it("starts an empty project's list at zero", () => {
    expect(nextSortOrder(null)).toBe(0);
  });

  it("puts the second deliverable after the first", () => {
    expect(nextSortOrder(0)).toBe(1);
  });

  it("appends past a gap rather than filling it", () => {
    expect(nextSortOrder(7)).toBe(8);
  });

  it("still appends when a hand-edited row sits below zero", () => {
    expect(nextSortOrder(-3)).toBe(-2);
  });
});
