import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_STATUS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  isProjectStatus,
  parseProjectStatus,
  projectStatusLabel,
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

describe("parseProjectStatus", () => {
  it("hands back each valid status unchanged", () => {
    for (const status of PROJECT_STATUSES) {
      expect(parseProjectStatus(status)).toBe(status);
    }
  });

  it("throws on anything else", () => {
    expect(() => parseProjectStatus("archived")).toThrow(
      /unknown project status/,
    );
    expect(() => parseProjectStatus(undefined)).toThrow(
      /unknown project status/,
    );
  });

  it("lists the alternatives in the message", () => {
    expect(() => parseProjectStatus("live")).toThrow(
      /draft, active, paused, closed/,
    );
  });

  it("quotes the offending value so a blank one is visible", () => {
    expect(() => parseProjectStatus(" ")).toThrow(/" "/);
  });
});

describe("projectStatusLabel", () => {
  it("labels every status the schema allows", () => {
    for (const status of PROJECT_STATUSES) {
      expect(projectStatusLabel(status)).toBe(PROJECT_STATUS_LABELS[status]);
      expect(projectStatusLabel(status)).not.toBe("");
    }
  });

  it("gives each status a distinct label", () => {
    const labels = PROJECT_STATUSES.map(projectStatusLabel);
    expect(new Set(labels).size).toBe(PROJECT_STATUSES.length);
  });
});
