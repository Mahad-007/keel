import { describe, expect, it } from "vitest";

import { clampToGrid, gridMove, isSameCell, moveInGrid } from "./grid";

describe("gridMove", () => {
  it("reads the four arrows", () => {
    expect(gridMove({ key: "ArrowLeft" })).toBe("left");
    expect(gridMove({ key: "ArrowRight" })).toBe("right");
    expect(gridMove({ key: "ArrowUp" })).toBe("up");
    expect(gridMove({ key: "ArrowDown" })).toBe("down");
  });

  it("reads Home and End as the ends of the row", () => {
    expect(gridMove({ key: "Home" })).toBe("row-start");
    expect(gridMove({ key: "End" })).toBe("row-end");
  });

  it("reads them with Ctrl as the ends of the sheet", () => {
    expect(gridMove({ key: "Home", ctrlKey: true })).toBe("sheet-start");
    expect(gridMove({ key: "End", ctrlKey: true })).toBe("sheet-end");
  });

  it("accepts Cmd for the same, so a Mac keyboard can reach it", () => {
    expect(gridMove({ key: "Home", metaKey: true })).toBe("sheet-start");
    expect(gridMove({ key: "End", metaKey: true })).toBe("sheet-end");
  });

  it("ignores a modifier on the arrows", () => {
    expect(gridMove({ key: "ArrowRight", ctrlKey: true })).toBe("right");
  });

  it("leaves Tab alone, so the grid can be escaped", () => {
    expect(gridMove({ key: "Tab" })).toBeNull();
  });

  it("leaves every other key alone", () => {
    expect(gridMove({ key: "Enter" })).toBeNull();
    expect(gridMove({ key: "Escape" })).toBeNull();
    expect(gridMove({ key: " " })).toBeNull();
    expect(gridMove({ key: "a" })).toBeNull();
    expect(gridMove({ key: "PageDown" })).toBeNull();
  });
});

describe("clampToGrid", () => {
  const size = { rows: 4, columns: 7 };

  it("leaves a position already inside alone", () => {
    expect(clampToGrid({ row: 2, column: 3 }, size)).toEqual({
      row: 2,
      column: 3,
    });
  });

  it("pulls a row past the end back to the last one", () => {
    expect(clampToGrid({ row: 10, column: 3 }, size)).toEqual({
      row: 3,
      column: 3,
    });
  });

  it("keeps the column when only the row has to move", () => {
    expect(clampToGrid({ row: 10, column: 6 }, size).column).toBe(6);
  });

  it("pulls a negative position back to the corner", () => {
    expect(clampToGrid({ row: -2, column: -1 }, size)).toEqual({
      row: 0,
      column: 0,
    });
  });

  it("clamps an empty grid to the corner rather than past it", () => {
    expect(clampToGrid({ row: 3, column: 3 }, { rows: 0, columns: 0 })).toEqual({
      row: 0,
      column: 0,
    });
  });

  it("is idempotent", () => {
    const once = clampToGrid({ row: 9, column: 9 }, size);
    expect(clampToGrid(once, size)).toEqual(once);
  });
});

describe("moveInGrid", () => {
  /** Four projects over a seven-day week: the shape the page renders. */
  const size = { rows: 4, columns: 7 };
  const middle = { row: 1, column: 3 };

  it("steps one cell in each direction", () => {
    expect(moveInGrid(middle, size, { key: "ArrowLeft" })).toEqual({
      row: 1,
      column: 2,
    });
    expect(moveInGrid(middle, size, { key: "ArrowRight" })).toEqual({
      row: 1,
      column: 4,
    });
    expect(moveInGrid(middle, size, { key: "ArrowUp" })).toEqual({
      row: 0,
      column: 3,
    });
    expect(moveInGrid(middle, size, { key: "ArrowDown" })).toEqual({
      row: 2,
      column: 3,
    });
  });

  it("stays on the day when it changes row", () => {
    expect(moveInGrid(middle, size, { key: "ArrowDown" })?.column).toBe(3);
  });

  it("stays on the project when it changes day", () => {
    expect(moveInGrid(middle, size, { key: "ArrowRight" })?.row).toBe(1);
  });

  it("stops at the first column rather than wrapping to the row above", () => {
    expect(moveInGrid({ row: 2, column: 0 }, size, { key: "ArrowLeft" })).toEqual(
      { row: 2, column: 0 },
    );
  });

  it("stops at the last column rather than wrapping to the row below", () => {
    expect(moveInGrid({ row: 2, column: 6 }, size, { key: "ArrowRight" })).toEqual(
      { row: 2, column: 6 },
    );
  });

  it("stops at the top and the bottom row", () => {
    expect(moveInGrid({ row: 0, column: 3 }, size, { key: "ArrowUp" })).toEqual({
      row: 0,
      column: 3,
    });
    expect(moveInGrid({ row: 3, column: 3 }, size, { key: "ArrowDown" })).toEqual({
      row: 3,
      column: 3,
    });
  });

  it("jumps to the ends of the row", () => {
    expect(moveInGrid(middle, size, { key: "Home" })).toEqual({
      row: 1,
      column: 0,
    });
    expect(moveInGrid(middle, size, { key: "End" })).toEqual({
      row: 1,
      column: 6,
    });
  });

  it("jumps to the ends of the sheet with a modifier", () => {
    expect(moveInGrid(middle, size, { key: "Home", ctrlKey: true })).toEqual({
      row: 0,
      column: 0,
    });
    expect(moveInGrid(middle, size, { key: "End", metaKey: true })).toEqual({
      row: 3,
      column: 6,
    });
  });

  it("hands a key it has no use for back to the browser", () => {
    expect(moveInGrid(middle, size, { key: "Tab" })).toBeNull();
    expect(moveInGrid(middle, size, { key: "x" })).toBeNull();
  });

  it("brings a stale cursor inside the grid as it moves", () => {
    expect(moveInGrid({ row: 9, column: 9 }, size, { key: "ArrowUp" })).toEqual({
      row: 3,
      column: 6,
    });
  });

  it("lands on the corner of a one-cell grid whatever is pressed", () => {
    const only = { rows: 1, columns: 1 };
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "End"]) {
      expect(moveInGrid({ row: 0, column: 0 }, only, { key })).toEqual({
        row: 0,
        column: 0,
      });
    }
  });

  it("walks a whole row one press at a time", () => {
    let at = { row: 0, column: 0 };
    for (let step = 0; step < 10; step += 1) {
      at = moveInGrid(at, size, { key: "ArrowRight" }) ?? at;
    }
    expect(at).toEqual({ row: 0, column: 6 });
  });
});

describe("isSameCell", () => {
  it("is true for the same row and column", () => {
    expect(isSameCell({ row: 2, column: 3 }, { row: 2, column: 3 })).toBe(true);
  });

  it("is false when either differs", () => {
    expect(isSameCell({ row: 2, column: 3 }, { row: 2, column: 4 })).toBe(false);
    expect(isSameCell({ row: 2, column: 3 }, { row: 1, column: 3 })).toBe(false);
  });
});
