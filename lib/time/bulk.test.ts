import { describe, expect, it } from "vitest";

import {
  bulkCellName,
  bulkCellNames,
  parseBulkCellName,
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
