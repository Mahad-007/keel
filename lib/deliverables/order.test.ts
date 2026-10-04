import { describe, expect, it } from "vitest";

import {
  canMove,
  isMoveDirection,
  MOVE_DIRECTIONS,
  moveBy,
  moveOne,
  parseMoveDirection,
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

  it("leaves no gap where a vanished deliverable sat", () => {
    expect(orderChanges(current, ["a", "gone", "b", "c"])).toEqual([]);
  });

  it("still closes up the list around a vanished deliverable", () => {
    expect(orderChanges(current, ["gone", "c", "a", "b"])).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
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

describe("isMoveDirection", () => {
  it("accepts the two directions a control can ask for", () => {
    expect(isMoveDirection("up")).toBe(true);
    expect(isMoveDirection("down")).toBe(true);
  });

  it("rejects a word that is not a direction", () => {
    expect(isMoveDirection("top")).toBe(false);
    expect(isMoveDirection("Up")).toBe(false);
    expect(isMoveDirection("")).toBe(false);
  });

  it("rejects the inherited keys every object answers to", () => {
    expect(isMoveDirection("__proto__")).toBe(false);
    expect(isMoveDirection("constructor")).toBe(false);
    expect(isMoveDirection("toString")).toBe(false);
  });

  it("rejects everything that is not a string", () => {
    expect(isMoveDirection(undefined)).toBe(false);
    expect(isMoveDirection(null)).toBe(false);
    expect(isMoveDirection(-1)).toBe(false);
  });
});

describe("parseMoveDirection", () => {
  it("hands back the direction it was given", () => {
    expect(parseMoveDirection("up")).toBe("up");
    expect(parseMoveDirection("down")).toBe("down");
  });

  it("throws on anything else, naming the value and the alternatives", () => {
    expect(() => parseMoveDirection("sideways")).toThrow(
      /"sideways".*up, down/,
    );
  });
});

describe("moveOne with a direction it does not recognise", () => {
  it("refuses rather than moving the deliverable to the top", () => {
    expect(() =>
      moveOne(["a", "b", "c"], "c", "__proto__" as "up"),
    ).toThrow(/unknown move direction/);
  });
});

describe("MOVE_DIRECTIONS", () => {
  it("lists both directions, front of the list first", () => {
    expect(MOVE_DIRECTIONS).toEqual(["up", "down"]);
  });

  it("lists every direction a move can be asked for", () => {
    for (const direction of MOVE_DIRECTIONS) {
      expect(isMoveDirection(direction)).toBe(true);
    }
    expect(MOVE_DIRECTIONS).toHaveLength(2);
  });
});

describe("canMove", () => {
  it("will not move the first deliverable up", () => {
    expect(canMove(1, 4, "up")).toBe(false);
  });

  it("will not move the last deliverable down", () => {
    expect(canMove(4, 4, "down")).toBe(false);
  });

  it("moves a deliverable in the middle either way", () => {
    expect(canMove(2, 4, "up")).toBe(true);
    expect(canMove(2, 4, "down")).toBe(true);
  });

  it("offers nothing for the only deliverable in a list", () => {
    expect(canMove(1, 1, "up")).toBe(false);
    expect(canMove(1, 1, "down")).toBe(false);
  });

  it("offers nothing for a position the list does not have", () => {
    expect(canMove(5, 4, "up")).toBe(false);
    expect(canMove(0, 4, "down")).toBe(false);
    expect(canMove(1, 0, "down")).toBe(false);
  });

  it("agrees with the move itself about which way up is", () => {
    const ids = ["a", "b", "c"];
    for (const [index, id] of ids.entries()) {
      for (const direction of ["up", "down"] as const) {
        const moved = moveOne(ids, id, direction);
        expect(canMove(index + 1, ids.length, direction)).toBe(moved !== ids);
      }
    }
  });
});
