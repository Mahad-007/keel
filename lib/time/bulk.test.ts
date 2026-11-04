import { describe, expect, it } from "vitest";

import {
  bulkCellName,
  bulkCellNames,
  parseBulkCellName,
  parseBulkCells,
  typedBulkCells,
  BULK_CELL_PREFIX,
} from "./bulk";

describe("bulkCellName", () => {
  it("joins the prefix, the project and the day", () => {
    expect(
      bulkCellName({ projectId: "prj_abc", workedOn: "2026-10-19" }),
    ).toBe("cell:prj_abc:2026-10-19");
  });

  it("starts with the prefix, so a cell cannot be mistaken for another field", () => {
    const name = bulkCellName({
      projectId: "prj_abc",
      workedOn: "2026-10-19",
    });
    expect(name.startsWith(`${BULK_CELL_PREFIX}:`)).toBe(true);
  });

  it("gives two cells of one row different names", () => {
    const monday = bulkCellName({
      projectId: "prj_abc",
      workedOn: "2026-10-19",
    });
    const tuesday = bulkCellName({
      projectId: "prj_abc",
      workedOn: "2026-10-20",
    });
    expect(monday).not.toBe(tuesday);
  });

  it("gives two rows on one day different names", () => {
    const first = bulkCellName({
      projectId: "prj_abc",
      workedOn: "2026-10-19",
    });
    const second = bulkCellName({
      projectId: "prj_def",
      workedOn: "2026-10-19",
    });
    expect(first).not.toBe(second);
  });
});

describe("parseBulkCellName", () => {
  it("reads back the pair a name was built from", () => {
    const address = { projectId: "prj_abc", workedOn: "2026-10-19" };
    expect(parseBulkCellName(bulkCellName(address))).toEqual(address);
  });

  it("refuses a name under another prefix", () => {
    expect(parseBulkCellName("note:prj_abc:2026-10-19")).toBeNull();
  });

  it("refuses a name with a part missing", () => {
    expect(parseBulkCellName("cell:prj_abc")).toBeNull();
  });

  it("refuses a name with something tacked on the end", () => {
    expect(parseBulkCellName("cell:prj_abc:2026-10-19:billable")).toBeNull();
  });

  it("refuses a blank project", () => {
    expect(parseBulkCellName("cell::2026-10-19")).toBeNull();
  });

  it("refuses a blank day", () => {
    expect(parseBulkCellName("cell:prj_abc:")).toBeNull();
  });

  it("refuses a field that is not a cell at all", () => {
    expect(parseBulkCellName("week")).toBeNull();
  });
});

describe("bulkCellNames", () => {
  const days = ["2026-10-19", "2026-10-20", "2026-10-21"];

  it("gives one name per project per day", () => {
    expect(bulkCellNames(["prj_a", "prj_b"], days)).toHaveLength(6);
  });

  it("reads a row at a time, earliest day first", () => {
    expect(bulkCellNames(["prj_a", "prj_b"], days.slice(0, 2))).toEqual([
      "cell:prj_a:2026-10-19",
      "cell:prj_a:2026-10-20",
      "cell:prj_b:2026-10-19",
      "cell:prj_b:2026-10-20",
    ]);
  });

  it("names every cell exactly once", () => {
    const names = bulkCellNames(["prj_a", "prj_b", "prj_c"], days);
    expect(new Set(names).size).toBe(names.length);
  });

  it("offers nothing when there are no rows", () => {
    expect(bulkCellNames([], days)).toEqual([]);
  });

  it("offers nothing when the week has no days", () => {
    expect(bulkCellNames(["prj_a"], [])).toEqual([]);
  });

  it("produces names the parser reads back as the pair they came from", () => {
    for (const name of bulkCellNames(["prj_a", "prj_b"], days)) {
      const address = parseBulkCellName(name);
      expect(address).not.toBeNull();
      expect(bulkCellName(address!)).toBe(name);
    }
  });
});

describe("typedBulkCells", () => {
  const names = bulkCellNames(["prj_a", "prj_b"], [
    "2026-10-19",
    "2026-10-20",
  ]);

  it("keeps only the cells with something in them", () => {
    const typed = typedBulkCells(names, {
      "cell:prj_a:2026-10-19": "2h",
      "cell:prj_a:2026-10-20": "",
      "cell:prj_b:2026-10-19": "",
      "cell:prj_b:2026-10-20": "30",
    });
    expect(typed.map((cell) => cell.name)).toEqual([
      "cell:prj_a:2026-10-19",
      "cell:prj_b:2026-10-20",
    ]);
  });

  it("carries the pair each typed cell is about", () => {
    const [cell] = typedBulkCells(names, {
      "cell:prj_b:2026-10-20": "45m",
    });
    expect(cell.address).toEqual({
      projectId: "prj_b",
      workedOn: "2026-10-20",
    });
  });

  it("keeps the text exactly as typed", () => {
    const [cell] = typedBulkCells(names, {
      "cell:prj_a:2026-10-19": " 1h 30m ",
    });
    expect(cell.text).toBe(" 1h 30m ");
  });

  it("treats whitespace as a cell nobody filled in", () => {
    expect(
      typedBulkCells(names, { "cell:prj_a:2026-10-19": "   " }),
    ).toEqual([]);
  });

  it("treats a missing field as blank rather than failing", () => {
    expect(typedBulkCells(names, {})).toEqual([]);
  });

  it("ignores a field the grid never offered", () => {
    const typed = typedBulkCells(names, {
      "cell:prj_elsewhere:2026-10-19": "8h",
    });
    expect(typed).toEqual([]);
  });

  it("keeps the cells in grid order whatever order the fields are in", () => {
    const typed = typedBulkCells(names, {
      "cell:prj_b:2026-10-19": "1h",
      "cell:prj_a:2026-10-20": "2h",
    });
    expect(typed.map((cell) => cell.name)).toEqual([
      "cell:prj_a:2026-10-20",
      "cell:prj_b:2026-10-19",
    ]);
  });

  it("skips a name that is not a cell name at all", () => {
    expect(typedBulkCells(["week"], { week: "2026-10-19" })).toEqual([]);
  });
});

describe("parseBulkCells", () => {
  const days = ["2026-10-19", "2026-10-20"];
  const names = bulkCellNames(["prj_a", "prj_b"], days);

  it("reads every typed cell as a draft entry", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "2h",
      "cell:prj_b:2026-10-20": "90",
    });
    expect(parsed).toEqual({
      ok: true,
      value: [
        { projectId: "prj_a", workedOn: "2026-10-19", minutes: 120 },
        { projectId: "prj_b", workedOn: "2026-10-20", minutes: 90 },
      ],
    });
  });

  it("reads a sheet with nothing typed as no drafts at all", () => {
    expect(parseBulkCells(names, {})).toEqual({ ok: true, value: [] });
  });

  it("accepts the spellings the log-time form accepts", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "1h30m",
      "cell:prj_a:2026-10-20": "45m",
      "cell:prj_b:2026-10-19": "1.5h",
      "cell:prj_b:2026-10-20": "90",
    });
    expect(parsed.ok && parsed.value.map((draft) => draft.minutes)).toEqual([
      90, 45, 90, 90,
    ]);
  });

  /*
    The spellings a cap on the box would have ruined. `1 hour 30 minutes` cut
    to eight characters is `1 hour 3`, which the parser reads as 63 minutes
    rather than refusing — so these are here to say that a cell holds whatever
    somebody types and the parser is what decides.
  */
  it("reads a duration written out in words", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "1 hour 30 minutes",
      "cell:prj_a:2026-10-20": "90 minutes",
      "cell:prj_b:2026-10-19": "2 hours 30 minutes",
    });
    expect(parsed.ok && parsed.value.map((draft) => draft.minutes)).toEqual([
      90, 90, 150,
    ]);
  });

  it("does not read a long spelling as the figure its first few characters make", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "1 hour 30 minutes",
    });
    expect(parsed.ok && parsed.value[0].minutes).not.toBe(63);
  });

  it("keeps the drafts in grid order", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_b:2026-10-19": "1h",
      "cell:prj_a:2026-10-20": "2h",
    });
    expect(
      parsed.ok && parsed.value.map((draft) => draft.projectId),
    ).toEqual(["prj_a", "prj_b"]);
  });

  it("refuses the whole sheet when one cell cannot be read", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "2h",
      "cell:prj_b:2026-10-20": "lunch",
    });
    expect(parsed.ok).toBe(false);
  });

  it("keys the message under the cell that could not be read", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "2h",
      "cell:prj_b:2026-10-20": "lunch",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors)).toEqual(["cell:prj_b:2026-10-20"]);
  });

  it("reports every unreadable cell rather than only the first", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "1:30",
      "cell:prj_a:2026-10-20": "1,5h",
      "cell:prj_b:2026-10-19": ".5",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors)).toEqual([
      "cell:prj_a:2026-10-19",
      "cell:prj_a:2026-10-20",
      "cell:prj_b:2026-10-19",
    ]);
  });

  it("refuses a cell of no time at all", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "0",
    });
    expect(parsed.ok).toBe(false);
  });

  it("refuses a negative duration", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "-1h",
    });
    expect(parsed.ok).toBe(false);
  });

  it("refuses a cell longer than the day it is filed under", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "25h",
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a cell of exactly one day", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_a:2026-10-19": "24h",
    });
    expect(parsed.ok && parsed.value[0].minutes).toBe(1440);
  });

  it("writes nothing for a cell the grid never offered", () => {
    const parsed = parseBulkCells(names, {
      "cell:prj_elsewhere:2026-10-19": "8h",
    });
    expect(parsed).toEqual({ ok: true, value: [] });
  });
});
