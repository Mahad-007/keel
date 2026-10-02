import { describe, expect, it } from "vitest";

import {
  moveBy,
  moveOne,
  nextSortOrder,
  orderChanges,
  orderMismatch,
  positionsFor,
} from "./order";

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

describe("orderChanges", () => {
  const current = [
    { id: "a", sortOrder: 0 },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ];

  it("writes nothing when the order already holds", () => {
    expect(orderChanges(current, ["a", "b", "c"])).toEqual([]);
  });

  it("writes only the two rows a single swap moves", () => {
    expect(orderChanges(current, ["b", "a", "c"])).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("leaves the middle row alone when the ends are swapped", () => {
    expect(orderChanges(current, ["c", "b", "a"])).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("compacts positions that were left with gaps", () => {
    const gapped = [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 4 },
    ];

    expect(orderChanges(gapped, ["a", "b"])).toEqual([
      { id: "b", sortOrder: 1 },
    ]);
  });

  it("has no row to write for an id that no longer exists", () => {
    expect(orderChanges(current, ["a", "b", "c", "gone"])).toEqual([]);
  });

  it("has nothing to do for a project with no deliverables", () => {
    expect(orderChanges([], [])).toEqual([]);
  });
});

describe("orderMismatch", () => {
  const current = ["a", "b", "c"];

  it("accepts a rearrangement of exactly the same ids", () => {
    expect(orderMismatch(current, ["c", "a", "b"])).toBeNull();
  });

  it("accepts the order the list is already in", () => {
    expect(orderMismatch(current, current)).toBeNull();
  });

  it("accepts an empty order for a project with no deliverables", () => {
    expect(orderMismatch([], [])).toBeNull();
  });

  it("refuses an order that repeats a deliverable", () => {
    expect(orderMismatch(current, ["a", "a", "b", "c"])).toMatch(
      /same deliverable twice: a/,
    );
  });

  it("refuses an order naming a deliverable from somewhere else", () => {
    expect(orderMismatch(current, ["a", "b", "c", "other"])).toMatch(
      /not in this project: other/,
    );
  });

  it("refuses an order that leaves a deliverable out", () => {
    expect(orderMismatch(current, ["a", "b"])).toMatch(/leaves out deliverables: c/);
  });

  it("names every id it could not place", () => {
    expect(orderMismatch(current, ["a"])).toMatch(/b, c/);
  });

  it("reports the repeat before the ids it cannot find", () => {
    expect(orderMismatch(current, ["a", "a", "gone"])).toMatch(/twice/);
  });
});
