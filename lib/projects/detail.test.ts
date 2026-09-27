import { describe, expect, it } from "vitest";

import {
  describeRateOverride,
  parseProjectTabParam,
  projectPath,
  projectTabHref,
} from "./detail";
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

describe("parseProjectTabParam", () => {
  it("reads the tab the URL asked for", () => {
    expect(parseProjectTabParam({ tab: "time" })).toBe("time");
  });

  it("falls back to the default when no tab is named", () => {
    expect(parseProjectTabParam({})).toBe(DEFAULT_PROJECT_TAB);
  });

  it("falls back rather than failing on a tab that does not exist", () => {
    expect(parseProjectTabParam({ tab: "burn" })).toBe(DEFAULT_PROJECT_TAB);
  });

  it("takes the first of a repeated tab param", () => {
    expect(parseProjectTabParam({ tab: ["scope", "invoices"] })).toBe("scope");
  });

  it("round-trips every tab through its own href", () => {
    for (const tab of PROJECT_TABS) {
      const query = projectTabHref("prj_1", tab).split("?")[1] ?? "";
      const params = Object.fromEntries(new URLSearchParams(query));
      expect(parseProjectTabParam(params)).toBe(tab);
    }
  });
});

describe("describeRateOverride", () => {
  it("names the amount an override bills at", () => {
    expect(describeRateOverride(15_000)).toBe(
      "$150.00/hr, overriding the client's default.",
    );
  });

  it("says an absent override defers to the client", () => {
    expect(describeRateOverride(null)).toMatch(/client's default rate/);
  });

  it("tells a zero override apart from an absent one", () => {
    expect(describeRateOverride(0)).not.toBe(describeRateOverride(null));
    expect(describeRateOverride(0)).not.toContain("$0.00");
  });

  it("never renders a rate the project does not have", () => {
    expect(describeRateOverride(null)).not.toContain("$");
  });
});
