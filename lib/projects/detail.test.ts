import { describe, expect, it } from "vitest";

import { projectPath } from "./detail";

describe("projectPath", () => {
  it("hangs the project off the projects list path", () => {
    expect(projectPath("prj_abc123")).toBe("/projects/prj_abc123");
  });

  it("escapes an id that would otherwise change the path", () => {
    expect(projectPath("a/b")).toBe("/projects/a%2Fb");
    expect(projectPath("a?b=1")).toBe("/projects/a%3Fb%3D1");
  });
});
