import { describe, expect, it } from "vitest";

import { moveBy, moveOne, nextSortOrder, positionsFor } from "./order";

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

describe("moveBy at the edges", () => {
  const ids = ["a", "b", "c"];

  it("keeps the first deliverable first when asked to move it up", () => {
    expect(moveBy(ids, "a", -1)).toEqual(ids);
  });

  it("keeps the last deliverable last when asked to move it down", () => {
    expect(moveBy(ids, "c", 1)).toEqual(ids);
  });

  it("clamps a move that overshoots either end", () => {
    expect(moveBy(ids, "b", -9)).toEqual(["b", "a", "c"]);
    expect(moveBy(ids, "b", 9)).toEqual(["a", "c", "b"]);
  });

  it("has nothing to move in a one-item list", () => {
    expect(moveBy(["only"], "only", -1)).toEqual(["only"]);
    expect(moveBy(["only"], "only", 1)).toEqual(["only"]);
  });

  it("leaves the order alone for an id it cannot find", () => {
    expect(moveBy(ids, "gone", -1)).toEqual(ids);
    expect(moveBy([], "gone", 1)).toEqual([]);
  });
});

describe("moveOne", () => {
  const ids = ["a", "b", "c"];

  it("reads up as towards the front of the list", () => {
    expect(moveOne(ids, "c", "up")).toEqual(["a", "c", "b"]);
  });

  it("reads down as towards the back of the list", () => {
    expect(moveOne(ids, "a", "down")).toEqual(["b", "a", "c"]);
  });

  it("is a single step, never more", () => {
    expect(moveOne(ids, "c", "up")).toEqual(moveBy(ids, "c", -1));
    expect(moveOne(ids, "a", "down")).toEqual(moveBy(ids, "a", 1));
  });
});
