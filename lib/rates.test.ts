import { describe, expect, it } from "vitest";

import { projectRate } from "./rates";

describe("projectRate", () => {
  it("takes the override as the rate, and says the project set it", () => {
    expect(projectRate({ rateCents: 15000 })).toEqual({
      cents: 15000,
      source: "project",
    });
  });

  it("defers to the client when there is no override", () => {
    expect(projectRate({ rateCents: null })).toBeNull();
  });

  it("reads an override of zero as a decision, not as a missing one", () => {
    expect(projectRate({ rateCents: 0 })).toEqual({
      cents: 0,
      source: "project",
    });
  });

  it("carries an override below zero rather than repairing it", () => {
    expect(projectRate({ rateCents: -15000 })).toEqual({
      cents: -15000,
      source: "project",
    });
  });
});
