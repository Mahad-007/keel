import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_STATUS,
  PROJECT_STATUSES,
  isProjectStatus,
} from "./status";

describe("isProjectStatus", () => {
  it("accepts every status the schema allows", () => {
    for (const status of PROJECT_STATUSES) {
      expect(isProjectStatus(status)).toBe(true);
    }
  });

  it("rejects a string that is merely status-shaped", () => {
    expect(isProjectStatus("Active")).toBe(false);
    expect(isProjectStatus("archived")).toBe(false);
    expect(isProjectStatus("")).toBe(false);
    expect(isProjectStatus(" active")).toBe(false);
  });

  it("rejects values that are not strings at all", () => {
    expect(isProjectStatus(undefined)).toBe(false);
    expect(isProjectStatus(null)).toBe(false);
    expect(isProjectStatus(0)).toBe(false);
    expect(isProjectStatus(["active"])).toBe(false);
  });

  it("does not inherit anything from Object.prototype", () => {
    expect(isProjectStatus("toString")).toBe(false);
    expect(isProjectStatus("constructor")).toBe(false);
  });

  it("agrees that the default is a real status", () => {
    expect(isProjectStatus(DEFAULT_PROJECT_STATUS)).toBe(true);
  });
});
