import { describe, expect, it } from "vitest";

import { bulkCellName, parseBulkCellName, BULK_CELL_PREFIX } from "./bulk";

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
