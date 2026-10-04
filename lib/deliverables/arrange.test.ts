import { describe, expect, it } from "vitest";

import { applyScopeChange, type ArrangedDeliverable } from "./arrange";
import type { DeliverableStatus } from "./status";

function row(
  id: string,
  title: string,
  status: DeliverableStatus = "pending",
): ArrangedDeliverable {
  return { id, title, status };
}

const scope = [
  row("a", "Wireframes", "done"),
  row("b", "Build the booking flow", "started"),
  row("c", "Launch checklist"),
];

function ids(rows: readonly ArrangedDeliverable[]): string[] {
  return rows.map((moved) => moved.id);
}

describe("applying a move to the list on screen", () => {
  it("lifts a deliverable one place towards the front", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "c",
      direction: "up",
    });
    expect(ids(moved)).toEqual(["a", "c", "b"]);
  });

  it("drops a deliverable one place towards the back", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "a",
      direction: "down",
    });
    expect(ids(moved)).toEqual(["b", "a", "c"]);
  });

  it("leaves the first deliverable where it is", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "a",
      direction: "up",
    });
    expect(ids(moved)).toEqual(ids(scope));
  });

  it("leaves the last deliverable where it is", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "c",
      direction: "down",
    });
    expect(ids(moved)).toEqual(ids(scope));
  });

  it("ignores a deliverable this list no longer has", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "gone",
      direction: "up",
    });
    expect(ids(moved)).toEqual(ids(scope));
  });

  it("carries the whole row rather than rebuilding one", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "b",
      direction: "up",
    });
    expect(moved[0]).toBe(scope[1]);
  });

  it("changes no status on the way past", () => {
    const moved = applyScopeChange(scope, {
      kind: "move",
      id: "b",
      direction: "down",
    });
    expect(moved.map((one) => one.status).sort()).toEqual(
      scope.map((one) => one.status).sort(),
    );
  });

  it("leaves the list it was given alone", () => {
    applyScopeChange(scope, { kind: "move", id: "c", direction: "up" });
    expect(ids(scope)).toEqual(["a", "b", "c"]);
  });

  it("has nothing to move in an empty list", () => {
    expect(applyScopeChange([], { kind: "move", id: "a", direction: "up" })).toEqual(
      [],
    );
  });
});

describe("applying a status press to the list on screen", () => {
  it("sets the status of the row that was pressed", () => {
    const changed = applyScopeChange(scope, {
      kind: "status",
      id: "c",
      from: "pending",
      status: "started",
    });
    expect(changed[2].status).toBe("started");
  });

  it("leaves every other row exactly as it was", () => {
    const changed = applyScopeChange(scope, {
      kind: "status",
      id: "c",
      from: "pending",
      status: "started",
    });
    expect(changed[0]).toBe(scope[0]);
    expect(changed[1]).toBe(scope[1]);
  });

  it("keeps the order a status press found the list in", () => {
    const changed = applyScopeChange(scope, {
      kind: "status",
      id: "a",
      from: "done",
      status: "pending",
    });
    expect(ids(changed)).toEqual(ids(scope));
  });

  it("keeps the rest of the row it changed", () => {
    const changed = applyScopeChange(scope, {
      kind: "status",
      id: "b",
      from: "started",
      status: "done",
    });
    expect(changed[1]).toEqual({ ...scope[1], status: "done" });
  });

  it("ignores a deliverable this list no longer has", () => {
    const changed = applyScopeChange(scope, {
      kind: "status",
      id: "gone",
      from: "pending",
      status: "done",
    });
    expect(changed).toEqual(scope);
  });

  it("does not check what the row was: the write does that", () => {
    const changed = applyScopeChange(scope, {
      kind: "status",
      id: "a",
      from: "pending",
      status: "started",
    });
    expect(changed[0].status).toBe("started");
  });

  it("leaves the list it was given alone", () => {
    applyScopeChange(scope, {
      kind: "status",
      id: "a",
      from: "done",
      status: "pending",
    });
    expect(scope[0].status).toBe("done");
  });
});
