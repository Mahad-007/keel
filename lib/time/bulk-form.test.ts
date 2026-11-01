import { describe, expect, it } from "vitest";

import {
  blankBulkFields,
  failedBulkState,
  initialBulkState,
  readBulkFields,
  rejectedBulkState,
  savedBulkNotice,
  savedBulkState,
} from "./bulk-form";

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

const NAMES = ["cell:prj_a:2026-10-19", "cell:prj_a:2026-10-20"];

describe("initialBulkState", () => {
  it("starts with every box empty", () => {
    expect(initialBulkState(NAMES).fields).toEqual({
      "cell:prj_a:2026-10-19": "",
      "cell:prj_a:2026-10-20": "",
    });
  });

  it("starts with nothing wrong and nothing written", () => {
    const state = initialBulkState(NAMES);
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
    expect(state.saved).toBeNull();
  });
});

describe("savedBulkState", () => {
  const saved = { entryIds: ["tme_1", "tme_2"], minutes: 210 };

  it("reports what was written", () => {
    expect(savedBulkState(saved, NAMES).saved).toEqual(saved);
  });

  it("empties the grid, so a second press cannot log the week twice", () => {
    expect(savedBulkState(saved, NAMES).fields).toEqual({
      "cell:prj_a:2026-10-19": "",
      "cell:prj_a:2026-10-20": "",
    });
  });

  it("leaves nothing to fix", () => {
    const state = savedBulkState(saved, NAMES);
    expect(state.errors).toEqual({});
    expect(state.formError).toBeNull();
  });
});

describe("rejectedBulkState", () => {
  const typed = {
    "cell:prj_a:2026-10-19": "2h",
    "cell:prj_a:2026-10-20": "lunch",
  };

  it("keeps every figure that was typed", () => {
    expect(rejectedBulkState(typed, {}).fields).toEqual(typed);
  });

  it("carries the message for the cell that failed", () => {
    const state = rejectedBulkState(typed, {
      "cell:prj_a:2026-10-20": "not a length of time",
    });
    expect(state.errors["cell:prj_a:2026-10-20"]).toBe("not a length of time");
  });

  it("says nothing was written", () => {
    expect(rejectedBulkState(typed, {}).saved).toBeNull();
  });
});

describe("failedBulkState", () => {
  const typed = { "cell:prj_a:2026-10-19": "2h" };

  it("keeps the grid, so the press can be made again", () => {
    expect(failedBulkState(typed, "try again").fields).toEqual(typed);
  });

  it("puts the sentence on the form rather than on a cell", () => {
    const state = failedBulkState(typed, "try again");
    expect(state.formError).toBe("try again");
    expect(state.errors).toEqual({});
  });

  it("says nothing was written", () => {
    expect(failedBulkState(typed, "try again").saved).toBeNull();
  });
});

describe("savedBulkNotice", () => {
  it("says nothing when no press has landed", () => {
    expect(savedBulkNotice(initialBulkState(NAMES))).toBeNull();
  });

  it("reads the total back as the column holds it", () => {
    const notice = savedBulkNotice(
      savedBulkState({ entryIds: ["tme_1"], minutes: 90 }, NAMES),
    );
    expect(notice).toContain("1h 30m");
  });

  it("counts one cell in words rather than as a figure", () => {
    const notice = savedBulkNotice(
      savedBulkState({ entryIds: ["tme_1"], minutes: 120 }, NAMES),
    );
    expect(notice).toBe(
      "Logged 2h in one cell. The sheet now shows it and the boxes are empty again.",
    );
  });

  it("counts several cells", () => {
    const notice = savedBulkNotice(
      savedBulkState({ entryIds: ["tme_1", "tme_2", "tme_3"], minutes: 390 }, NAMES),
    );
    expect(notice).toBe(
      "Logged 6h 30m across 3 cells. The sheet now shows them and the boxes are empty again.",
    );
  });

  it("says nothing after a refusal", () => {
    expect(savedBulkNotice(rejectedBulkState({}, { a: "no" }))).toBeNull();
  });

  it("says nothing after a failure", () => {
    expect(savedBulkNotice(failedBulkState({}, "try again"))).toBeNull();
  });
});
