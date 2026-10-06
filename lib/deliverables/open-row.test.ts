import { describe, expect, it } from "vitest";

import {
  NO_OPEN_ROW,
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
