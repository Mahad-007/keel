import { describe, expect, it } from "vitest";

import { groupByProject } from "./portfolio";

describe("groupByProject", () => {
  it("files each row under the project it names", () => {
    const grouped = groupByProject([
      { projectId: "prj_a", value: 1 },
      { projectId: "prj_b", value: 2 },
    ]);

    expect(grouped.get("prj_a")).toEqual([{ projectId: "prj_a", value: 1 }]);
    expect(grouped.get("prj_b")).toEqual([{ projectId: "prj_b", value: 2 }]);
  });

  it("keeps several rows for one project in the order they arrived", () => {
    const grouped = groupByProject([
      { projectId: "prj_a", value: 1 },
      { projectId: "prj_b", value: 9 },
      { projectId: "prj_a", value: 2 },
      { projectId: "prj_a", value: 3 },
    ]);

    expect(grouped.get("prj_a")?.map((row) => row.value)).toEqual([1, 2, 3]);
  });

  it("has no group for a project no row mentions", () => {
    const grouped = groupByProject([{ projectId: "prj_a", value: 1 }]);

    expect(grouped.get("prj_b")).toBeUndefined();
  });

  it("groups nothing out of an empty list", () => {
    expect(groupByProject([]).size).toBe(0);
  });
});
