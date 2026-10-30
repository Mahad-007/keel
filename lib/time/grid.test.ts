import { describe, expect, it } from "vitest";

import { clampToGrid, gridMove } from "./grid";

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
