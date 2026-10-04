import { describe, expect, it } from "vitest";

import {
  announceScopeChange,
  applyScopeChange,
  moveButtonLabel,
  statusButtonLabel,
  readScopeChange,
  SCOPE_FIELD_NAMES,
  SCOPE_PROBLEMS,
  staleStatusProblem,
  type ArrangedDeliverable,
} from "./arrange";
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

function press(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

describe("reading a press of a row's controls", () => {
  it("reads a move up", () => {
    expect(readScopeChange(press({ id: "dlv_wire", direction: "up" }))).toEqual({
      kind: "move",
      id: "dlv_wire",
      direction: "up",
    });
  });

  it("reads a move down", () => {
    expect(
      readScopeChange(press({ id: "dlv_wire", direction: "down" })),
    ).toEqual({ kind: "move", id: "dlv_wire", direction: "down" });
  });

  it("reads a status press, and what the row said when it was pressed", () => {
    expect(
      readScopeChange(press({ id: "dlv_wire", from: "pending", status: "started" })),
    ).toEqual({
      kind: "status",
      id: "dlv_wire",
      from: "pending",
      status: "started",
    });
  });

  it("uses the field names the row's controls are built from", () => {
    const form = new FormData();
    form.set(SCOPE_FIELD_NAMES.id, "dlv_wire");
    form.set(SCOPE_FIELD_NAMES.direction, "up");
    expect(readScopeChange(form)).toEqual({
      kind: "move",
      id: "dlv_wire",
      direction: "up",
    });
  });

  it("refuses a press that names no deliverable", () => {
    expect(readScopeChange(press({ direction: "up" }))).toBeNull();
    expect(readScopeChange(press({ id: "   ", direction: "up" }))).toBeNull();
  });

  it("refuses a direction that is not one of the two", () => {
    expect(readScopeChange(press({ id: "dlv_wire", direction: "top" }))).toBeNull();
    expect(readScopeChange(press({ id: "dlv_wire", direction: "UP" }))).toBeNull();
  });

  it("refuses a status the list does not know", () => {
    expect(
      readScopeChange(press({ id: "dlv_wire", from: "pending", status: "shipped" })),
    ).toBeNull();
  });

  it("refuses a status press that does not say what the row was", () => {
    expect(
      readScopeChange(press({ id: "dlv_wire", status: "started" })),
    ).toBeNull();
  });

  it("reads a press on a row holding a status the app does not know", () => {
    expect(
      readScopeChange(
        press({ id: "dlv_wire", from: "abandoned", status: "pending" }),
      ),
    ).toEqual({
      kind: "status",
      id: "dlv_wire",
      from: "abandoned",
      status: "pending",
    });
  });

  it("refuses a submission with no control in it at all", () => {
    expect(readScopeChange(press({ id: "dlv_wire" }))).toBeNull();
  });

  it("ignores a file posted where a direction belongs", () => {
    const form = new FormData();
    form.set("id", "dlv_wire");
    form.set("direction", new File([], "up.txt"));
    expect(readScopeChange(form)).toBeNull();
  });
});

describe("announcing a move", () => {
  it("names the deliverable and where it ended up", () => {
    expect(
      announceScopeChange(scope, { kind: "move", id: "c", direction: "up" }),
    ).toBe("Moved “Launch checklist” to position 2 of 3.");
  });

  it("counts the position the way the list draws it", () => {
    expect(
      announceScopeChange(scope, { kind: "move", id: "a", direction: "down" }),
    ).toBe("Moved “Wireframes” to position 2 of 3.");
  });

  it("says so when the press moved nothing at the front", () => {
    expect(
      announceScopeChange(scope, { kind: "move", id: "a", direction: "up" }),
    ).toBe("“Wireframes” is already first.");
  });

  it("says so when the press moved nothing at the back", () => {
    expect(
      announceScopeChange(scope, { kind: "move", id: "c", direction: "down" }),
    ).toBe("“Launch checklist” is already last.");
  });

  it("has nothing to say about a deliverable this list no longer has", () => {
    expect(
      announceScopeChange(scope, { kind: "move", id: "gone", direction: "up" }),
    ).toBeNull();
  });

  it("agrees with the list the same change produces", () => {
    const change = { kind: "move", id: "b", direction: "down" } as const;
    const moved = applyScopeChange(scope, change);
    expect(announceScopeChange(scope, change)).toBe(
      `Moved “Build the booking flow” to position ${
        moved.findIndex((one) => one.id === "b") + 1
      } of ${moved.length}.`,
    );
  });
});

describe("announcing a status press", () => {
  it("says what the deliverable is now", () => {
    expect(
      announceScopeChange(scope, {
        kind: "status",
        id: "c",
        from: "pending",
        status: "started",
      }),
    ).toBe("“Launch checklist” is now in progress.");
  });

  it("says a finished deliverable is finished", () => {
    expect(
      announceScopeChange(scope, {
        kind: "status",
        id: "b",
        from: "started",
        status: "done",
      }),
    ).toBe("“Build the booking flow” is now done.");
  });

  it("says where a reopened deliverable went", () => {
    expect(
      announceScopeChange(scope, {
        kind: "status",
        id: "a",
        from: "done",
        status: "pending",
      }),
    ).toBe("“Wireframes” is now back on the list as not started.");
  });

  it("has nothing to say about a deliverable this list no longer has", () => {
    expect(
      announceScopeChange(scope, {
        kind: "status",
        id: "gone",
        from: "pending",
        status: "done",
      }),
    ).toBeNull();
  });
});

describe("a status press aimed at a row that has moved on", () => {
  it("passes when the row still says what the press said it did", () => {
    expect(staleStatusProblem(row("a", "Wireframes", "started"), "started")).toBeNull();
  });

  it("refuses when somebody else has already changed it", () => {
    expect(staleStatusProblem(row("a", "Wireframes", "done"), "started")).toBe(
      "“Wireframes” is already done, so nothing was changed. Reload to see what the scope list says now.",
    );
  });

  it("names the status the row holds, not the one the page showed", () => {
    expect(
      staleStatusProblem(row("a", "Wireframes", "pending"), "done"),
    ).toContain("back on the list as not started");
  });

  it("refuses a press made against a status the row has never held", () => {
    expect(staleStatusProblem(row("a", "Wireframes", "started"), "abandoned")).toBe(
      "“Wireframes” is already in progress, so nothing was changed. Reload to see what the scope list says now.",
    );
  });

  it("lets a press against a hand-edited status through", () => {
    const edited = row("a", "Wireframes", "abandoned" as DeliverableStatus);
    expect(staleStatusProblem(edited, "abandoned")).toBeNull();
  });

  it("refuses every status but the one the press was made against", () => {
    const stored = row("a", "Wireframes", "started");
    expect(staleStatusProblem(stored, "pending")).not.toBeNull();
    expect(staleStatusProblem(stored, "done")).not.toBeNull();
  });
});

describe("the sentences a refused press comes back with", () => {
  it("gives no two problems the same sentence", () => {
    const sentences = Object.values(SCOPE_PROBLEMS);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it("tells the reader what to do next", () => {
    for (const sentence of Object.values(SCOPE_PROBLEMS)) {
      expect(sentence).toMatch(/(Reload|try again)/);
    }
  });

  it("says that nothing was written, so a press is not half-applied", () => {
    for (const sentence of Object.values(SCOPE_PROBLEMS)) {
      expect(sentence).toMatch(/[Nn]othing was (changed|written)/);
    }
  });
});

describe("what a row's controls are called", () => {
  it("names the deliverable a move acts on", () => {
    expect(moveButtonLabel("Wireframes", "up")).toBe("Move “Wireframes” up");
    expect(moveButtonLabel("Wireframes", "down")).toBe("Move “Wireframes” down");
  });

  it("tells two rows' move controls apart", () => {
    expect(moveButtonLabel("Wireframes", "up")).not.toBe(
      moveButtonLabel("Launch checklist", "up"),
    );
  });

  it("puts the verb first on the status control", () => {
    expect(statusButtonLabel("Wireframes", "pending")).toBe(
      "Start “Wireframes”",
    );
    expect(statusButtonLabel("Wireframes", "started")).toBe(
      "Mark done “Wireframes”",
    );
    expect(statusButtonLabel("Wireframes", "done")).toBe(
      "Reopen “Wireframes”",
    );
  });

  it("gives a row's three controls three different names", () => {
    const names = [
      statusButtonLabel("Wireframes", "pending"),
      moveButtonLabel("Wireframes", "up"),
      moveButtonLabel("Wireframes", "down"),
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
