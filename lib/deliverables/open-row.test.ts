import { describe, expect, it } from "vitest";

import {
  closeScopeRow,
  NO_OPEN_ROW,
  openRowStillThere,
  openScopeRow,
  scopeRowMode,
} from "./open-row";

describe("opening a row of a scope list", () => {
  it("starts with nothing open", () => {
    expect(scopeRowMode(NO_OPEN_ROW, "dlv_wire")).toBeNull();
  });

  it("opens the row it was asked about, for what it was asked for", () => {
    const open = openScopeRow("dlv_wire", "edit");
    expect(scopeRowMode(open, "dlv_wire")).toBe("edit");
  });

  it("leaves every other row closed", () => {
    const open = openScopeRow("dlv_wire", "edit");
    expect(scopeRowMode(open, "dlv_flows")).toBeNull();
  });

  it("closes the row that was open when another one opens", () => {
    const open = openScopeRow("dlv_flows", "confirm");
    expect(scopeRowMode(open, "dlv_wire")).toBeNull();
    expect(scopeRowMode(open, "dlv_flows")).toBe("confirm");
  });

  it("replaces one mode with the other on the same row", () => {
    // Pressing Delete while editing is a reader changing their mind about what
    // they are doing to that line, not a request for both at once.
    const open = openScopeRow("dlv_wire", "confirm");
    expect(scopeRowMode(open, "dlv_wire")).toBe("confirm");
  });
});

describe("closing a row", () => {
  it("closes the row that asked", () => {
    const open = openScopeRow("dlv_wire", "edit");
    expect(closeScopeRow(open, "dlv_wire")).toBeNull();
  });

  it("leaves a different row's editor alone", () => {
    // A save answers after the press. By then the reader may have cancelled and
    // opened another line, and the answer must not shut the form they are in.
    const open = openScopeRow("dlv_flows", "edit");
    expect(closeScopeRow(open, "dlv_wire")).toBe(open);
  });

  it("does nothing when the list is already closed", () => {
    expect(closeScopeRow(NO_OPEN_ROW, "dlv_wire")).toBeNull();
  });
});

describe("an open row whose deliverable has gone", () => {
  it("stays open while the list still has it", () => {
    const open = openScopeRow("dlv_wire", "edit");
    expect(openRowStillThere(open, ["dlv_flows", "dlv_wire"])).toBe(open);
  });

  it("closes once the list no longer has it", () => {
    const open = openScopeRow("dlv_wire", "confirm");
    expect(openRowStillThere(open, ["dlv_flows"])).toBeNull();
  });

  it("closes when the list has emptied", () => {
    expect(openRowStillThere(openScopeRow("dlv_wire", "edit"), [])).toBeNull();
  });

  it("leaves a closed list closed without reading the list", () => {
    expect(openRowStillThere(NO_OPEN_ROW, ["dlv_wire"])).toBeNull();
  });
});
