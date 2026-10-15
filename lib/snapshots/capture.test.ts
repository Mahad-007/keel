import { describe, expect, it } from "vitest";

import { capturedSnapshotLines, sameRecordedOrder } from "./capture";

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

/** A recorded line, written as the one field the order is read off. */
function recorded(deliverableId: string) {
  return { deliverableId };
}

describe("sameRecordedOrder", () => {
  it("says two copies of one list are in the same order", () => {
    expect(
      sameRecordedOrder(
        [recorded("a"), recorded("b"), recorded("c")],
        [recorded("a"), recorded("b"), recorded("c")],
      ),
    ).toBe(true);
  });

  it("sees two lines swapped over", () => {
    expect(
      sameRecordedOrder(
        [recorded("a"), recorded("b"), recorded("c")],
        [recorded("b"), recorded("a"), recorded("c")],
      ),
    ).toBe(false);
  });

  it("sees a line moved to the end of the list", () => {
    expect(
      sameRecordedOrder(
        [recorded("a"), recorded("b"), recorded("c")],
        [recorded("b"), recorded("c"), recorded("a")],
      ),
    ).toBe(false);
  });

  it("sees a line dropped out of the list", () => {
    expect(
      sameRecordedOrder([recorded("a"), recorded("b")], [recorded("a")]),
    ).toBe(false);
  });

  it("sees a line added to the end", () => {
    expect(
      sameRecordedOrder([recorded("a")], [recorded("a"), recorded("b")]),
    ).toBe(false);
  });

  it("reads the same list of one as unmoved", () => {
    expect(sameRecordedOrder([recorded("a")], [recorded("a")])).toBe(true);
  });

  it("reads two empty lists as being in the same order", () => {
    // Nothing to put in an order is not a difference in order. The capture
    // refuses an empty scope list before it ever asks.
    expect(sameRecordedOrder([], [])).toBe(true);
  });

  /*
    Only the sequence is read, so a snapshot naming one deliverable twice is a
    list the capture cannot produce — it reads a primary key — and the lengths
    settle it before the ids are compared.
  */
  it("will not match a list holding one deliverable twice", () => {
    expect(
      sameRecordedOrder(
        [recorded("a"), recorded("a"), recorded("b")],
        [recorded("a"), recorded("b")],
      ),
    ).toBe(false);
  });
});
