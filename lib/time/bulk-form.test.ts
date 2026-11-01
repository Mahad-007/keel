import { describe, expect, it } from "vitest";

import { blankBulkFields, readBulkFields } from "./bulk-form";

describe("blankBulkFields", () => {
  it("holds a blank string for every cell", () => {
    expect(blankBulkFields(["cell:prj_a:2026-10-19", "cell:prj_a:2026-10-20"]))
      .toEqual({
        "cell:prj_a:2026-10-19": "",
        "cell:prj_a:2026-10-20": "",
      });
  });

  it("holds nothing for a grid with no cells", () => {
    expect(blankBulkFields([])).toEqual({});
  });

  it("gives every name a key rather than leaving it undefined", () => {
    const fields = blankBulkFields(["cell:prj_a:2026-10-19"]);
    expect(Object.hasOwn(fields, "cell:prj_a:2026-10-19")).toBe(true);
  });
});

describe("readBulkFields", () => {
  it("reads the cells it was asked for", () => {
    const body = new FormData();
    body.set("cell:prj_a:2026-10-19", "2h");
    body.set("cell:prj_a:2026-10-20", "");

    expect(
      readBulkFields(body, [
        "cell:prj_a:2026-10-19",
        "cell:prj_a:2026-10-20",
      ]),
    ).toEqual({
      "cell:prj_a:2026-10-19": "2h",
      "cell:prj_a:2026-10-20": "",
    });
  });

  it("reads a cell the submission left out as blank", () => {
    expect(readBulkFields(new FormData(), ["cell:prj_a:2026-10-19"])).toEqual({
      "cell:prj_a:2026-10-19": "",
    });
  });

  it("never reads a cell the grid did not offer", () => {
    const body = new FormData();
    body.set("cell:prj_elsewhere:2026-10-19", "8h");

    expect(readBulkFields(body, ["cell:prj_a:2026-10-19"])).toEqual({
      "cell:prj_a:2026-10-19": "",
    });
  });

  it("reads a file posted to a cell as blank rather than failing", () => {
    const body = new FormData();
    body.set("cell:prj_a:2026-10-19", new File(["8h"], "hours.txt"));

    expect(readBulkFields(body, ["cell:prj_a:2026-10-19"])).toEqual({
      "cell:prj_a:2026-10-19": "",
    });
  });
});
