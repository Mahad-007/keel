import { describe, expect, it } from "vitest";

import {
  importNote,
  IMPORT_NOTES,
  importTextLines,
  MAX_IMPORT_TITLE,
  parseImportLine,
  splitImportLine,
  titleKeys,
} from "./import";

/** One line of a paste, as it arrives from `importTextLines`. */
function line(text: string, number = 1) {
  return parseImportLine({ number, text });
}

function problem(text: string): string {
  const read = line(text);
  if (read.ok) throw new Error(`expected “${text}” to be refused`);
  return read.problem;
}

function draft(text: string) {
  const read = line(text);
  if (!read.ok) throw new Error(`expected “${text}” to read: ${read.problem}`);
  return read.draft;
}

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

describe("the title a pasted line is read as", () => {
  it("is the line itself when there is no estimate on it", () => {
    expect(draft("Discovery workshop")).toEqual({
      title: "Discovery workshop",
      estimatedMinutes: 0,
    });
  });

  it("keeps the line number it was pasted on", () => {
    expect(line("Discovery", 7).number).toBe(7);
  });

  it("keeps the text as pasted, so the preview can show both", () => {
    expect(line("Wireframes | 1.5").text).toBe("Wireframes | 1.5");
  });

  it("refuses a line that is an estimate with nothing to call it", () => {
    expect(problem("| 2")).toBe("Title is required.");
  });

  it("takes a title at the column's limit", () => {
    expect(draft("W".repeat(MAX_IMPORT_TITLE)).title).toHaveLength(
      MAX_IMPORT_TITLE,
    );
  });

  it("refuses a title one character past the limit", () => {
    expect(problem("W".repeat(MAX_IMPORT_TITLE + 1))).toBe(
      `Title must be ${MAX_IMPORT_TITLE} characters or fewer.`,
    );
  });
});

describe("the estimate a pasted line is read as", () => {
  it("is zero on a line that carries none, which reads as unsized", () => {
    expect(draft("Discovery").estimatedMinutes).toBe(0);
  });

  it("reads hours as whole minutes", () => {
    expect(draft("Wireframes | 1.5").estimatedMinutes).toBe(90);
    expect(draft("Build\t2").estimatedMinutes).toBe(120);
  });

  it("reads a bar with nothing after it as unsized rather than wrong", () => {
    expect(draft("Launch |").estimatedMinutes).toBe(0);
  });

  it("refuses an estimate that is not a number of hours", () => {
    expect(problem("Build | ask Dana")).toBe(
      "Estimate must be a number of hours, like 2 or 1.5.",
    );
  });

  it("refuses the whole of a line with a second separator in it", () => {
    expect(problem("Build | 1.5 | ask Dana")).toBe(
      "Estimate must be a number of hours, like 2 or 1.5.",
    );
  });

  it("refuses a negative estimate, as the form does", () => {
    expect(problem("Build | -2")).toBe("Estimate cannot be negative.");
  });

  it("refuses an estimate too large to be hours somebody meant", () => {
    expect(problem("Build | 90000")).toBe(
      "Estimate must be 1000 hours or less.",
    );
  });

  it("says both things about a line wrong in both halves", () => {
    expect(problem("| nonsense")).toBe(
      "Title is required. Estimate must be a number of hours, like 2 or 1.5.",
    );
  });
});

describe("what a line is remarked on for", () => {
  const nothing = titleKeys([]);

  it("says nothing about a title nobody has seen before", () => {
    expect(importNote("Discovery", nothing, nothing)).toBeNull();
  });

  it("says a line repeats an earlier one in the same paste", () => {
    expect(importNote("Discovery", titleKeys(["Discovery"]), nothing)).toBe(
      IMPORT_NOTES.repeated,
    );
  });

  it("says a title is already on the project's list", () => {
    expect(importNote("Discovery", nothing, titleKeys(["Discovery"]))).toBe(
      IMPORT_NOTES.agreed,
    );
  });

  it("says both, the paste first, when both are true", () => {
    expect(
      importNote("Discovery", titleKeys(["Discovery"]), titleKeys(["Discovery"])),
    ).toBe(`${IMPORT_NOTES.repeated} ${IMPORT_NOTES.agreed}`);
  });

  it("counts a difference of case as the same title", () => {
    expect(importNote("discovery", titleKeys(["Discovery"]), nothing)).toBe(
      IMPORT_NOTES.repeated,
    );
  });

  it("counts a difference of spacing as the same title", () => {
    expect(
      importNote("Discovery  workshop", titleKeys(["Discovery workshop"]), nothing),
    ).toBe(IMPORT_NOTES.repeated);
  });

  it("tells two genuinely different titles apart", () => {
    expect(importNote("Discovery", titleKeys(["Discovery call"]), nothing)).toBeNull();
  });
});
