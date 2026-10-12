import { describe, expect, it } from "vitest";

import { importTextLines } from "./import";

describe("the lines a paste is read as", () => {
  it("numbers them from one, in the order they were pasted", () => {
    expect(importTextLines("Discovery\nWireframes\nBuild")).toEqual([
      { number: 1, text: "Discovery" },
      { number: 2, text: "Wireframes" },
      { number: 3, text: "Build" },
    ]);
  });

  it("trims each line, because a pasted list is full of stray spaces", () => {
    expect(importTextLines("  Discovery\t \n\tWireframes  ")).toEqual([
      { number: 1, text: "Discovery" },
      { number: 2, text: "Wireframes" },
    ]);
  });

  it("drops the blank line a paste almost always ends with", () => {
    expect(importTextLines("Discovery\n")).toEqual([
      { number: 1, text: "Discovery" },
    ]);
  });

  it("drops a line holding only whitespace", () => {
    expect(importTextLines("Discovery\n   \nBuild")).toEqual([
      { number: 1, text: "Discovery" },
      { number: 3, text: "Build" },
    ]);
  });

  it("keeps the numbers the reader can count to past a gap", () => {
    expect(importTextLines("\n\nDiscovery").map((line) => line.number)).toEqual([
      3,
    ]);
  });

  it("reads the same list whichever line ending typed it", () => {
    const expected = [
      { number: 1, text: "Discovery" },
      { number: 2, text: "Build" },
    ];
    expect(importTextLines("Discovery\r\nBuild")).toEqual(expected);
    expect(importTextLines("Discovery\rBuild")).toEqual(expected);
  });

  it("reads nothing out of an empty paste", () => {
    expect(importTextLines("")).toEqual([]);
    expect(importTextLines("  \n\t\n")).toEqual([]);
  });
});
