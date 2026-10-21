import { describe, expect, it } from "vitest";

import {
  closedRow,
  NO_OPEN_ROW,
  openedRow,
  openRowStillThere,
  rowAfterRemoval,
  rowMode,
} from "./rows";

describe("opening a row of a list", () => {
  it("starts with nothing open", () => {
    expect(rowMode(NO_OPEN_ROW, "dlv_wire")).toBeNull();
  });

  it("opens the row it was asked about, for what it was asked for", () => {
    const open = openedRow("dlv_wire", "edit");
    expect(rowMode(open, "dlv_wire")).toBe("edit");
  });

  it("leaves every other row closed", () => {
    const open = openedRow("dlv_wire", "edit");
    expect(rowMode(open, "dlv_flows")).toBeNull();
  });

  it("closes the row that was open when another one opens", () => {
    const open = openedRow("dlv_flows", "confirm");
    expect(rowMode(open, "dlv_wire")).toBeNull();
    expect(rowMode(open, "dlv_flows")).toBe("confirm");
  });

  it("replaces one mode with the other on the same row", () => {
    // Pressing Delete while editing is a reader changing their mind about what
    // they are doing to that line, not a request for both at once.
    const open = openedRow("dlv_wire", "confirm");
    expect(rowMode(open, "dlv_wire")).toBe("confirm");
  });
});

describe("closing a row", () => {
  it("closes the row that asked", () => {
    const open = openedRow("dlv_wire", "edit");
    expect(closedRow(open, "dlv_wire")).toBeNull();
  });

  it("leaves a different row's editor alone", () => {
    // A save answers after the press. By then the reader may have cancelled and
    // opened another line, and the answer must not shut the form they are in.
    const open = openedRow("dlv_flows", "edit");
    expect(closedRow(open, "dlv_wire")).toBe(open);
  });

  it("does nothing when the list is already closed", () => {
    expect(closedRow(NO_OPEN_ROW, "dlv_wire")).toBeNull();
  });
});

describe("an open row that has left the list", () => {
  it("stays open while the list still has it", () => {
    const open = openedRow("dlv_wire", "edit");
    expect(openRowStillThere(open, ["dlv_flows", "dlv_wire"])).toBe(open);
  });

  it("closes once the list no longer has it", () => {
    const open = openedRow("dlv_wire", "confirm");
    expect(openRowStillThere(open, ["dlv_flows"])).toBeNull();
  });

  it("closes when the list has emptied", () => {
    expect(openRowStillThere(openedRow("dlv_wire", "edit"), [])).toBeNull();
  });

  it("leaves a closed list closed without reading the list", () => {
    expect(openRowStillThere(NO_OPEN_ROW, ["dlv_wire"])).toBeNull();
  });
});

describe("where the cursor goes once a row is removed", () => {
  const ids = ["a", "b", "c"];

  it("goes to the row that took its place", () => {
    expect(rowAfterRemoval(ids, "a")).toBe("b");
    expect(rowAfterRemoval(ids, "b")).toBe("c");
  });

  it("goes to the row above when the last one is removed", () => {
    expect(rowAfterRemoval(ids, "c")).toBe("b");
  });

  it("has nowhere to go when the only row is removed", () => {
    expect(rowAfterRemoval(["a"], "a")).toBeNull();
  });

  it("has nowhere to go for a row the list does not have", () => {
    expect(rowAfterRemoval(ids, "z")).toBeNull();
    expect(rowAfterRemoval([], "a")).toBeNull();
  });
});
