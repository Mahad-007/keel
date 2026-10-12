import { describe, expect, it } from "vitest";

import { importTextLines, splitImportLine } from "./import";

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

describe("the two halves of a pasted line", () => {
  it("reads a line with no separator as all title", () => {
    expect(splitImportLine("Discovery workshop")).toEqual({
      title: "Discovery workshop",
      estimate: "",
    });
  });

  it("reads what follows a bar as the estimate", () => {
    expect(splitImportLine("Wireframes | 1.5")).toEqual({
      title: "Wireframes",
      estimate: "1.5",
    });
  });

  it("reads a tab the same way, which is how a spreadsheet pastes", () => {
    expect(splitImportLine("Wireframes\t1.5")).toEqual({
      title: "Wireframes",
      estimate: "1.5",
    });
  });

  it("splits at the first separator, whichever kind it is", () => {
    expect(splitImportLine("Build\tsecond | third")).toEqual({
      title: "Build",
      estimate: "second | third",
    });
    expect(splitImportLine("Build | second\tthird")).toEqual({
      title: "Build",
      estimate: "second\tthird",
    });
  });

  it("trims both halves, so the spacing around a bar is free", () => {
    expect(splitImportLine("  Launch   |   2  ")).toEqual({
      title: "Launch",
      estimate: "2",
    });
  });

  it("keeps a title's own internal spacing and punctuation", () => {
    expect(splitImportLine("Logo — three variants")).toEqual({
      title: "Logo — three variants",
      estimate: "",
    });
  });

  it("reads a separator with nothing after it as no estimate", () => {
    expect(splitImportLine("Launch |")).toEqual({
      title: "Launch",
      estimate: "",
    });
  });

  it("reads a separator with nothing before it as no title", () => {
    expect(splitImportLine("| 2")).toEqual({ title: "", estimate: "2" });
  });
});
