import { describe, expect, it } from "vitest";

import { gridMove } from "./grid";

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
