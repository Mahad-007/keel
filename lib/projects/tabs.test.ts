import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_TAB,
  PROJECT_TABS,
  PROJECT_TAB_LABELS,
  PROJECT_TAB_SUMMARIES,
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

describe("PROJECT_TAB_LABELS", () => {
  it("labels every tab with something non-empty", () => {
    for (const tab of PROJECT_TABS) {
      expect(PROJECT_TAB_LABELS[tab].trim()).not.toBe("");
    }
  });

  it("gives no two tabs the same word", () => {
    const labels = PROJECT_TABS.map((tab) => PROJECT_TAB_LABELS[tab]);
    expect(new Set(labels).size).toBe(PROJECT_TABS.length);
  });

  it("spells out what the changes tab holds", () => {
    expect(PROJECT_TAB_LABELS.changes).toBe("Change orders");
  });
});

describe("PROJECT_TAB_SUMMARIES", () => {
  it("summarises every tab", () => {
    for (const tab of PROJECT_TABS) {
      expect(PROJECT_TAB_SUMMARIES[tab].trim()).not.toBe("");
    }
  });

  it("says something different about each one", () => {
    const summaries = PROJECT_TABS.map((tab) => PROJECT_TAB_SUMMARIES[tab]);
    expect(new Set(summaries).size).toBe(PROJECT_TABS.length);
  });

  it("writes each summary as a sentence, not a heading", () => {
    for (const tab of PROJECT_TABS) {
      expect(PROJECT_TAB_SUMMARIES[tab]).toMatch(/\.$/);
    }
  });
});
