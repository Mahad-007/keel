import { describe, expect, it } from "vitest";

import {
  canImport,
  importNote,
  importSizePhrase,
  importSummary,
  IMPORT_NOTES,
  IMPORT_TEXT_PROBLEMS,
  importTextProblem,
  importTextLines,
  MAX_IMPORT_CHARS,
  MAX_IMPORT_LINES,
  MAX_IMPORT_TITLE,
  parseImportLine,
  previewImport,
  splitImportLine,
  titleKeys,
  tooManyLinesProblem,
} from "./import";

/** A paste of `count` plausible deliverables. */
function pasteOf(count: number): string {
  return Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join(
    "\n",
  );
}

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

describe("the pastes that are refused before being read", () => {
  it("accepts an ordinary pasted list", () => {
    expect(importTextProblem("Discovery\nWireframes")).toBeNull();
  });

  it("refuses an empty box", () => {
    expect(importTextProblem("")).toBe(IMPORT_TEXT_PROBLEMS.empty);
  });

  it("refuses a box holding only blank lines", () => {
    expect(importTextProblem("\n  \n\t\n")).toBe(IMPORT_TEXT_PROBLEMS.empty);
  });

  it("refuses a paste longer than the box was meant to hold", () => {
    expect(importTextProblem("W".repeat(MAX_IMPORT_CHARS + 1))).toBe(
      IMPORT_TEXT_PROBLEMS.tooLong,
    );
  });

  it("takes a paste exactly as long as the box allows", () => {
    expect(importTextProblem("W".repeat(MAX_IMPORT_CHARS))).toBeNull();
  });

  it("takes a paste of exactly the line limit", () => {
    expect(importTextProblem(pasteOf(MAX_IMPORT_LINES))).toBeNull();
  });

  it("refuses one line past the limit, and says how many there were", () => {
    expect(importTextProblem(pasteOf(MAX_IMPORT_LINES + 1))).toBe(
      tooManyLinesProblem(MAX_IMPORT_LINES + 1),
    );
  });

  it("counts only the lines with something on them", () => {
    const spaced = pasteOf(MAX_IMPORT_LINES).split("\n").join("\n\n");
    expect(importTextProblem(spaced)).toBeNull();
  });
});

const PASTE = [
  "Discovery workshop | 2",
  "Wireframes\t6",
  "Build",
  "| 4",
  "Launch | soon",
  "discovery workshop",
].join("\n");

describe("the preview a mixed paste produces", () => {
  const preview = previewImport(PASTE, ["Build"]);

  it("keeps every line, readable or not", () => {
    expect(preview.lines.map((readLine) => readLine.number)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("carries only the readable lines as drafts, in order", () => {
    expect(preview.drafts).toEqual([
      { title: "Discovery workshop", estimatedMinutes: 120 },
      { title: "Wireframes", estimatedMinutes: 360 },
      { title: "Build", estimatedMinutes: 0 },
      { title: "discovery workshop", estimatedMinutes: 0 },
    ]);
  });

  it("counts the lines it could not read", () => {
    expect(preview.problemCount).toBe(2);
  });

  it("counts the readable lines worth a remark", () => {
    expect(preview.noteCount).toBe(2);
  });

  it("remarks on the line already agreed on the project", () => {
    expect(preview.lines[2]).toMatchObject({
      ok: true,
      note: IMPORT_NOTES.agreed,
    });
  });

  it("remarks on the second of two lines saying the same thing", () => {
    expect(preview.lines[0]).toMatchObject({ ok: true, note: null });
    expect(preview.lines[5]).toMatchObject({
      ok: true,
      note: IMPORT_NOTES.repeated,
    });
  });

  it("does not let a refused line count as a title above the next one", () => {
    const repeated = previewImport("| 4\nLaunch", []);
    expect(repeated.lines[1]).toMatchObject({ ok: true, note: null });
  });
});

describe("the preview of a paste with nothing in it", () => {
  it("has no lines, no drafts and nothing to remark on", () => {
    expect(previewImport("", [])).toEqual({
      lines: [],
      drafts: [],
      problemCount: 0,
      noteCount: 0,
    });
  });
});

describe("which previews may be committed", () => {
  it("allows a paste every line of which read", () => {
    expect(canImport(previewImport("Discovery\nBuild | 2", []))).toBe(true);
  });

  it("refuses a paste with one line it could not read", () => {
    expect(canImport(previewImport("Discovery\n| 2", []))).toBe(false);
  });

  it("refuses a paste that reads as nothing at all", () => {
    expect(canImport(previewImport("", []))).toBe(false);
  });

  it("allows a paste whose only objection is a repeated title", () => {
    const preview = previewImport("Revision round\nRevision round", []);
    expect(preview.noteCount).toBe(1);
    expect(canImport(preview)).toBe(true);
  });
});

describe("the size a paste would add", () => {
  function phrase(text: string): string {
    return importSizePhrase(previewImport(text, []).drafts);
  }

  it("counts one deliverable in the singular", () => {
    expect(phrase("Discovery | 2")).toBe("1 deliverable and 2h");
  });

  it("totals the estimates it was given", () => {
    expect(phrase("Discovery | 2\nWireframes | 1.5")).toBe(
      "2 deliverables and 3h 30m",
    );
  });

  it("says so when nothing in the paste was estimated", () => {
    expect(phrase("Discovery\nWireframes")).toBe(
      "2 deliverables, none of them estimated",
    );
  });

  it("names the figure the total does not speak for", () => {
    expect(phrase("Discovery | 2\nWireframes\nBuild")).toBe(
      "3 deliverables and 2h, with 2 not estimated",
    );
  });

  it("claims no total for a paste with nothing in it", () => {
    expect(phrase("")).toBe("0 deliverables, none of them estimated");
  });
});

describe("the sentence above a preview", () => {
  function summary(text: string, agreed: readonly string[] = []): string {
    return importSummary(previewImport(text, agreed));
  }

  it("says what a clean paste amounts to and nothing else", () => {
    expect(summary("Discovery | 2\nBuild | 1")).toBe(
      "This paste reads as 2 deliverables and 3h.",
    );
  });

  it("says nothing will be imported while a line cannot be read", () => {
    expect(summary("Discovery | 2\n| 4")).toBe(
      "This paste reads as 1 deliverable and 2h. One line below cannot be read as a deliverable, so nothing will be imported until you fix or delete it.",
    );
  });

  it("counts several unreadable lines and asks for all of them", () => {
    expect(summary("| 4\nBuild | nonsense\nDiscovery")).toBe(
      "This paste reads as 1 deliverable, none of them estimated. 2 lines below cannot be read as a deliverable, so nothing will be imported until you fix or delete them.",
    );
  });

  it("points at the remark on a line that repeats another", () => {
    expect(summary("Build\nBuild")).toBe(
      "This paste reads as 2 deliverables, none of them estimated. One line is worth a second look — see the note beside it.",
    );
  });

  it("points at several remarks when there are several", () => {
    expect(summary("Build\nBuild\nDiscovery", ["Discovery"])).toBe(
      "This paste reads as 3 deliverables, none of them estimated. 2 lines are worth a second look — see the notes beside them.",
    );
  });

  it("says so when the whole paste reads as nothing", () => {
    expect(summary("| 4")).toBe(
      "Nothing in this paste reads as a deliverable. One line below cannot be read as a deliverable, so nothing will be imported until you fix or delete it.",
    );
  });
});
