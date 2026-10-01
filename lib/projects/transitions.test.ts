import { describe, expect, it } from "vitest";

import { PROJECT_STATUSES, type ProjectStatus } from "./status";
import {
  allowedTransitions,
  canTransition,
  checkTransition,
  PROJECT_TRANSITIONS,
  refuseTransition,
  TRANSITION_REASON_LIMIT,
  transitionRequiresReason,
  transitionVerb,
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

/** The other nine of the sixteen pairs. Together with LEGAL that is all of them. */
const ILLEGAL: readonly (readonly [ProjectStatus, ProjectStatus])[] = [
  ["draft", "draft"],
  ["draft", "paused"],
  ["active", "draft"],
  ["active", "active"],
  ["paused", "draft"],
  ["paused", "paused"],
  ["closed", "draft"],
  ["closed", "paused"],
  ["closed", "closed"],
];

describe("canTransition on an illegal move", () => {
  it.each(ILLEGAL)("refuses %s to %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("accounts for every pair of statuses between them", () => {
    const pairs = PROJECT_STATUSES.flatMap((from) =>
      PROJECT_STATUSES.map((to) => `${from}->${to}`),
    );
    const covered = [...LEGAL, ...ILLEGAL].map(
      ([from, to]) => `${from}->${to}`,
    );

    expect(covered.sort()).toEqual(pairs.sort());
  });

  it("refuses every move out of a status outside the four", () => {
    for (const to of PROJECT_STATUSES) {
      expect(canTransition("mothballed" as ProjectStatus, to)).toBe(false);
    }
  });
});

describe("transitionVerb", () => {
  it("calls the first move out of a draft starting the work", () => {
    expect(transitionVerb("draft", "active")).toBe("Start");
  });

  it("calls closing a draft a cancellation, because nothing ran", () => {
    expect(transitionVerb("draft", "closed")).toBe("Cancel");
  });

  it("distinguishes resuming from starting", () => {
    expect(transitionVerb("paused", "active")).toBe("Resume");
  });

  it("distinguishes reopening from both", () => {
    expect(transitionVerb("closed", "active")).toBe("Reopen");
  });

  it("gives every legal move a verb", () => {
    for (const [from, to] of LEGAL) {
      expect(transitionVerb(from, to)).toBeTruthy();
    }
  });

  it("gives no verb to a move that cannot be made", () => {
    for (const [from, to] of ILLEGAL) {
      expect(transitionVerb(from, to)).toBeNull();
    }
  });
});

describe("transitionRequiresReason", () => {
  it("demands one to reopen a closed project", () => {
    expect(transitionRequiresReason("closed", "active")).toBe(true);
  });

  it("demands nothing of any other legal move", () => {
    const demanding = LEGAL.filter(([from, to]) =>
      transitionRequiresReason(from, to),
    );

    expect(demanding).toEqual([["closed", "active"]]);
  });

  it("does not make starting a draft feel like reopening", () => {
    expect(transitionRequiresReason("draft", "active")).toBe(false);
    expect(transitionRequiresReason("paused", "active")).toBe(false);
  });
});

describe("refuseTransition", () => {
  it("says nothing about a move that is allowed", () => {
    for (const [from, to] of LEGAL) {
      expect(refuseTransition(from, to)).toBeNull();
    }
  });

  it("gives every refused move a sentence to show", () => {
    for (const [from, to] of ILLEGAL) {
      expect(refuseTransition(from, to)).toMatch(/\.$/);
    }
  });

  it("tells a reader standing still that they already are", () => {
    expect(refuseTransition("active", "active")).toBe(
      "This project is already active.",
    );
    expect(refuseTransition("draft", "draft")).toBe(
      "This project is already a draft.",
    );
  });

  it("explains that draft is a beginning, not a destination", () => {
    for (const from of ["active", "paused", "closed"] as const) {
      expect(refuseTransition(from, "draft")).toMatch(/goes back to it/);
    }
  });

  it("tells a draft to start before it can pause", () => {
    expect(refuseTransition("draft", "paused")).toMatch(/Start it first/);
  });

  it("tells a closed project to reopen before it can pause", () => {
    expect(refuseTransition("closed", "paused")).toMatch(/Reopen it first/);
  });

  it("names the stored value when the status is not one of the four", () => {
    expect(refuseTransition("mothballed" as ProjectStatus, "active")).toBe(
      'A project that is "mothballed" cannot become active.',
    );
  });
});

describe("checkTransition on a legal move", () => {
  it("passes every legal move that needs no reason", () => {
    for (const [from, to] of LEGAL) {
      if (transitionRequiresReason(from, to)) continue;
      expect(checkTransition(from, to, null)).toBeNull();
    }
  });

  it("passes a legal move carrying a note nobody asked for", () => {
    expect(checkTransition("active", "paused", "Client went quiet.")).toBeNull();
  });

  it("passes the reopening once it has a reason", () => {
    expect(
      checkTransition("closed", "active", "They came back for phase two."),
    ).toBeNull();
  });
});

describe("checkTransition on an illegal move", () => {
  it.each(ILLEGAL)("refuses %s to %s as illegal", (from, to) => {
    expect(checkTransition(from, to, null)?.code).toBe("illegal");
  });

  it("carries the refusal's own sentence rather than a generic one", () => {
    expect(checkTransition("closed", "paused", null)?.message).toBe(
      refuseTransition("closed", "paused"),
    );
  });

  it("stays illegal however good the reason is", () => {
    expect(
      checkTransition("closed", "draft", "We agreed to start over.")?.code,
    ).toBe("illegal");
  });
});

describe("checkTransition on the reason", () => {
  it("refuses a reopening with nothing said", () => {
    expect(checkTransition("closed", "active", null)?.code).toBe(
      "reason-required",
    );
  });

  it("asks for the reason in words a person can act on", () => {
    expect(checkTransition("closed", "active", null)?.message).toMatch(
      /Say why this is reopening/,
    );
  });

  it("accepts a reason at the length limit", () => {
    const reason = "x".repeat(TRANSITION_REASON_LIMIT);

    expect(checkTransition("closed", "active", reason)).toBeNull();
  });

  it("refuses a reason one character past the limit", () => {
    const reason = "x".repeat(TRANSITION_REASON_LIMIT + 1);

    expect(checkTransition("closed", "active", reason)?.code).toBe(
      "reason-too-long",
    );
  });

  it("caps the note on a move that never needed one", () => {
    const note = "x".repeat(TRANSITION_REASON_LIMIT + 1);

    expect(checkTransition("active", "paused", note)?.code).toBe(
      "reason-too-long",
    );
  });

  it("answers the illegality before the length", () => {
    const note = "x".repeat(TRANSITION_REASON_LIMIT + 1);

    expect(checkTransition("closed", "draft", note)?.code).toBe("illegal");
  });
});
