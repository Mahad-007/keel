import { describe, expect, it } from "vitest";

import { PROJECT_STATUSES, type ProjectStatus } from "./status";
import { PROJECT_TRANSITIONS } from "./transitions";

describe("PROJECT_TRANSITIONS", () => {
  it("gives every status a set of moves, even if it is empty", () => {
    for (const status of PROJECT_STATUSES) {
      expect(PROJECT_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("names only real statuses as destinations", () => {
    for (const targets of Object.values(PROJECT_TRANSITIONS)) {
      for (const target of targets) {
        expect(PROJECT_STATUSES).toContain(target);
      }
    }
  });

  it("never lets a status move to itself", () => {
    for (const status of PROJECT_STATUSES) {
      expect(PROJECT_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it("lets nothing move back to draft", () => {
    for (const status of PROJECT_STATUSES) {
      expect(PROJECT_TRANSITIONS[status]).not.toContain("draft");
    }
  });

  it("leaves every status reachable from a draft, directly or not", () => {
    const reached = new Set<ProjectStatus>(["draft"]);
    for (let step = 0; step < PROJECT_STATUSES.length; step += 1) {
      for (const from of [...reached]) {
        for (const to of PROJECT_TRANSITIONS[from]) reached.add(to);
      }
    }

    expect([...reached].sort()).toEqual([...PROJECT_STATUSES].sort());
  });
});
