import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_TAB,
  PROJECT_TABS,
  isProjectTab,
  parseProjectTab,
} from "./tabs";

describe("isProjectTab", () => {
  it("accepts every tab in the list", () => {
    for (const tab of PROJECT_TABS) {
      expect(isProjectTab(tab)).toBe(true);
    }
  });

  it("rejects a status, which is a different vocabulary", () => {
    expect(isProjectTab("active")).toBe(false);
  });

  it("rejects near misses in case and spacing", () => {
    expect(isProjectTab("Overview")).toBe(false);
    expect(isProjectTab(" scope")).toBe(false);
  });

  it("rejects values that are not strings at all", () => {
    expect(isProjectTab(undefined)).toBe(false);
    expect(isProjectTab(null)).toBe(false);
    expect(isProjectTab(["scope"])).toBe(false);
  });
});

describe("parseProjectTab", () => {
  it("keeps a tab it recognises", () => {
    expect(parseProjectTab("invoices")).toBe("invoices");
  });

  it("falls back to the default rather than throwing", () => {
    expect(parseProjectTab("deliverables")).toBe(DEFAULT_PROJECT_TAB);
    expect(parseProjectTab(undefined)).toBe(DEFAULT_PROJECT_TAB);
  });

  it("returns a tab that is actually in the list", () => {
    expect(PROJECT_TABS).toContain(parseProjectTab("nonsense"));
  });
});
