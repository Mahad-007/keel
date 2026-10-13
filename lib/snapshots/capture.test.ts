import { describe, expect, it } from "vitest";

import { capturedSnapshotLines } from "./capture";

const SCOPE = [
  {
    id: "dlv_1",
    title: "Discovery",
    description: "Two workshops.",
    estimatedMinutes: 480,
    status: "done" as const,
  },
  {
    id: "dlv_2",
    title: "Build",
    description: null,
    estimatedMinutes: 2_400,
    status: "started" as const,
  },
];

describe("capturedSnapshotLines", () => {
  it("carries every column the diff will compare", () => {
    const [first] = capturedSnapshotLines(SCOPE);

    expect(first).toEqual({
      deliverableId: "dlv_1",
      title: "Discovery",
      description: "Two workshops.",
      estimatedMinutes: 480,
      status: "done",
    });
  });

  it("renames the id to say which row it points at", () => {
    const lines = capturedSnapshotLines(SCOPE);

    expect(lines.map((line) => line.deliverableId)).toEqual(["dlv_1", "dlv_2"]);
    // The snapshot line gets an id of its own in the data layer, so carrying
    // the deliverable's as `id` would put it in the primary key.
    expect(lines[0]).not.toHaveProperty("id");
  });

  it("keeps the order the scope list was agreed in", () => {
    const lines = capturedSnapshotLines(SCOPE);

    expect(lines.map((line) => line.title)).toEqual(["Discovery", "Build"]);
  });

  it("keeps the status, because delivery is a change worth recording", () => {
    const lines = capturedSnapshotLines(SCOPE);

    expect(lines.map((line) => line.status)).toEqual(["done", "started"]);
  });

  it("captures an unsized line as the zero it holds", () => {
    const [line] = capturedSnapshotLines([
      { ...SCOPE[0], estimatedMinutes: 0 },
    ]);

    // Dropping it would make the snapshot smaller than the list, and the line
    // would later read as new.
    expect(line.estimatedMinutes).toBe(0);
  });

  it("copies a hand-edited row across rather than repairing it", () => {
    const [line] = capturedSnapshotLines([
      { ...SCOPE[0], title: "  Discovery  ", estimatedMinutes: -60 },
    ]);

    expect(line.title).toBe("  Discovery  ");
    expect(line.estimatedMinutes).toBe(-60);
  });

  it("captures an empty scope list as no lines", () => {
    expect(capturedSnapshotLines([])).toEqual([]);
  });
});
