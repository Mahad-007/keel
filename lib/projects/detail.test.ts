import { describe, expect, it } from "vitest";

import { projectPath, projectTabHref } from "./detail";
import { DEFAULT_PROJECT_TAB, PROJECT_TABS } from "./tabs";

describe("projectPath", () => {
  it("hangs the project off the projects list path", () => {
    expect(projectPath("prj_abc123")).toBe("/projects/prj_abc123");
  });

  it("escapes an id that would otherwise change the path", () => {
    expect(projectPath("a/b")).toBe("/projects/a%2Fb");
    expect(projectPath("a?b=1")).toBe("/projects/a%3Fb%3D1");
  });
});

describe("projectTabHref", () => {
  it("names the tab in the query string", () => {
    expect(projectTabHref("prj_1", "scope")).toBe("/projects/prj_1?tab=scope");
  });

  it("leaves the default tab out, so a project has one address", () => {
    expect(projectTabHref("prj_1", DEFAULT_PROJECT_TAB)).toBe("/projects/prj_1");
  });

  it("starts every tab link from the project's own path", () => {
    for (const tab of PROJECT_TABS) {
      expect(projectTabHref("prj_1", tab).startsWith(projectPath("prj_1"))).toBe(
        true,
      );
    }
  });

  it("gives each tab a distinct address", () => {
    const hrefs = PROJECT_TABS.map((tab) => projectTabHref("prj_1", tab));
    expect(new Set(hrefs).size).toBe(PROJECT_TABS.length);
  });
});
