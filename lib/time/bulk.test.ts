import { describe, expect, it } from "vitest";

import { bulkCellName, BULK_CELL_PREFIX } from "./bulk";

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
