import { describe, expect, it } from "vitest";

import { moveBy, nextSortOrder, positionsFor } from "./order";

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

describe("positionsFor", () => {
  it("numbers the list in the order it was given", () => {
    expect(positionsFor(["b", "a", "c"])).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("has nothing to number for an empty list", () => {
    expect(positionsFor([])).toEqual([]);
  });

  it("leaves no gaps, whatever the positions were before", () => {
    const positions = positionsFor(["a", "b", "c", "d"]);

    expect(positions.map((position) => position.sortOrder)).toEqual([0, 1, 2, 3]);
  });
});

describe("moveBy", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves a deliverable one place towards the front", () => {
    expect(moveBy(ids, "c", -1)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves a deliverable one place towards the back", () => {
    expect(moveBy(ids, "b", 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("swaps the pair rather than displacing the rest", () => {
    expect(moveBy(ids, "a", 1)).toEqual(["b", "a", "c", "d"]);
  });

  it("moves several places at once", () => {
    expect(moveBy(ids, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveBy(ids, "d", -3)).toEqual(["d", "a", "b", "c"]);
  });

  it("leaves the order alone when nothing asked to move", () => {
    expect(moveBy(ids, "b", 0)).toEqual(ids);
  });
});
