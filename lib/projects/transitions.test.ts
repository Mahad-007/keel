import { describe, expect, it } from "vitest";

import { PROJECT_STATUSES, type ProjectStatus } from "./status";
import {
  allowedTransitions,
  canTransition,
  PROJECT_TRANSITIONS,
} from "./transitions";

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

describe("allowedTransitions", () => {
  it("offers a draft the start and the cancellation", () => {
    expect(allowedTransitions("draft")).toEqual(["active", "closed"]);
  });

  it("offers a running project the pause and the close", () => {
    expect(allowedTransitions("active")).toEqual(["paused", "closed"]);
  });

  it("offers a paused project the resume and the close", () => {
    expect(allowedTransitions("paused")).toEqual(["active", "closed"]);
  });

  it("offers a closed project nothing but reopening", () => {
    expect(allowedTransitions("closed")).toEqual(["active"]);
  });

  it("offers a status outside the four nothing at all", () => {
    expect(allowedTransitions("mothballed" as ProjectStatus)).toEqual([]);
  });
});

/**
 * Every legal move, written out rather than read back off the map the guard
 * itself uses. A test that derives its expectations from the thing under test
 * passes whatever the map says, including a typo in it.
 */
const LEGAL: readonly (readonly [ProjectStatus, ProjectStatus])[] = [
  ["draft", "active"],
  ["draft", "closed"],
  ["active", "paused"],
  ["active", "closed"],
  ["paused", "active"],
  ["paused", "closed"],
  ["closed", "active"],
];

describe("canTransition on a legal move", () => {
  it.each(LEGAL)("allows %s to %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("covers every edge the map declares", () => {
    const declared = PROJECT_STATUSES.flatMap((from) =>
      PROJECT_TRANSITIONS[from].map((to) => `${from}->${to}`),
    );

    expect(declared.sort()).toEqual(
      LEGAL.map(([from, to]) => `${from}->${to}`).sort(),
    );
  });
});
